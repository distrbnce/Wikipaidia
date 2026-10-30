import { analyzePage } from "./evidence.js";
import { createWikiClient } from "./wiki-api.js";

export const SCAN_VERSION = 7;
export const LIMITS = Object.freeze({ archives: 5, userPages: 8, contributorRevisions: 50 });
const UNCHECKED_SOURCES = "User pages, talk archives, and past revisions have not been checked.";
const HISTORICAL_COVERAGE = "Notices may describe historical involvement; current text is not assessed.";

export function validateTitle(value) {
  if (typeof value !== "string") throw new Error("Open an English Wikipedia article to check disclosures.");
  const title = value.replaceAll("_", " ").trim();
  if (!title || title.length > 255 || /[\u0000-\u001f\u007f|#<>\[\]{}]/.test(title)) throw new Error("This article title cannot be checked.");
  return title;
}

/** A discussion may contain many requests; it is not many distinct conflicts. */
export function groupCoiRequests(evidence) {
  const groups = new Map();
  const keyFor = item => JSON.stringify([item.sourceTitle, item.sourceRevision ?? null]);
  const isRequest = item => item.kind === "coi" && item.coiType === "edit-request";
  for (const item of evidence) {
    if (!isRequest(item)) continue;
    const key = keyFor(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const output = [];
  const emitted = new Set();
  for (const item of evidence) {
    if (!isRequest(item) || groups.get(keyFor(item)).length < 2) {
      output.push(item);
      continue;
    }
    const key = keyFor(item);
    if (emitted.has(key)) continue;
    emitted.add(key);
    const requests = groups.get(key).map(request => ({
      id: request.id,
      sectionTitle: request.sectionTitle,
      topicTitle: request.topicTitle,
      sectionUrl: request.sectionUrl,
      sourceTitle: request.sourceTitle,
      sourceUrl: request.sourceUrl,
      sourceRevision: request.sourceRevision,
      sourceTimestamp: request.sourceTimestamp,
      sourceRole: request.sourceRole,
      sourceTemplate: request.sourceTemplate,
      contributor: request.contributor,
      requestSummary: request.requestSummary,
      requestSummaryExplicit: request.requestSummaryExplicit,
      requestStatus: request.requestStatus,
      requestReason: request.requestReason,
      contextExcerpt: request.contextExcerpt,
    }));
    output.push({
      id: `${item.id}-requests`, kind: "coi", coiType: "edit-request-group",
      heading: "COI edit requests", requestCount: requests.length, requests,
      summary: `${requests.length} edit requests in this discussion. A request does not establish payment or implementation.`,
      sourceTitle: item.sourceTitle, sourceUrl: item.sourceUrl,
      sourceRevision: item.sourceRevision, sourceTimestamp: item.sourceTimestamp,
      sourceRole: item.sourceRole, sourceTemplate: item.sourceTemplate, template: item.template, relationship: item.relationship,
    });
  }
  return output;
}

// baseResult is a previous scanner result from the caller's internal cache, never
// an object accepted from a content-script message or other external input.
function reusableBasicResult(baseResult, title) {
  if (!baseResult || baseResult.version !== SCAN_VERSION || baseResult.deep !== false ||
      !Array.isArray(baseResult.evidence) || !Array.isArray(baseResult.coverage) ||
      !Array.isArray(baseResult.warnings) || typeof baseResult.complete !== "boolean") return false;
  try { return validateTitle(baseResult.title) === title; }
  catch { return false; }
}

export async function scanArticle(rawTitle, { deep = false, baseResult, client = createWikiClient(), now = () => new Date().toISOString() } = {}) {
  const title = validateTitle(rawTitle);
  const result = {
    version: SCAN_VERSION, title, checkedAt: now(), deep: Boolean(deep),
    evidence: [], coverage: [], warnings: [], complete: true
  };
  const reuseBasic = deep && reusableBasicResult(baseResult, title);
  let article;
  let talk;
  if (reuseBasic) {
    article = { title };
    result.evidence = structuredClone(baseResult.evidence);
    result.coverage = baseResult.coverage.filter(line => line !== UNCHECKED_SOURCES && line !== HISTORICAL_COVERAGE);
    result.warnings = [...baseResult.warnings];
    result.complete = baseResult.complete;
  } else {
    const pages = await client.getPages([title, `Talk:${title}`]);
    article = pages.find(p => p.ns === 0 && !p.missing);
    if (!article) throw new Error("This check only supports existing English Wikipedia articles.");
    result.title = article.title;
    talk = pages.find(p => p.ns === 1);
    if (article.title !== title) {
      // Redirects can resolve an article without resolving its old talk page.
      try { talk = (await client.getPages([`Talk:${article.title}`])).find(p => p.ns === 1); }
      catch (error) {
        talk = null;
        result.complete = false;
        result.warnings.push(`The current article's talk page could not be checked. ${error.message}`);
      }
    }
    if (talk && !talk.missing && talk.title !== `Talk:${article.title}`) {
      result.complete = false;
      result.warnings.push("The talk page redirects to a differently titled discussion. Its notices were not attributed to this article.");
      talk = null;
    }
  }
  const seenPages = new Set();
  const checked = { archives: 0, userPages: 0 };

  function addPage(page, role) {
    if (seenPages.has(page.title)) return;
    seenPages.add(page.title);
    if (page.missing) return;
    if (page.unavailable) {
      result.complete = false;
      result.warnings.push(`The source for ${page.title} was unavailable.`);
      return;
    }
    if (role === "archive") checked.archives++;
    if (role === "user") checked.userPages++;
    result.evidence.push(...analyzePage({ ...page, role, articleTitle: article.title }));
  }

  if (!reuseBasic) {
    addPage(article, "article");
    if (talk) addPage(talk, "talk");
    result.coverage.push(`Current article: ${article.title}`, !talk ? "No talk-page source was returned." : talk.missing ? "The article has no current talk page." : `Current talk page: ${talk.title}`);
    if (!talk && result.complete) {
      result.complete = false;
      result.warnings.push("The talk-page source was missing from Wikipedia's response.");
    }
    result.coverage.push("Templates checked; prose and edit summaries not analyzed.");
  }

  if (deep) {
    let archiveTitles = [];
    let users = [];
    try {
      const archives = await client.getArchiveTitles(article.title, LIMITS.archives);
      archiveTitles = archives.titles;
      result.coverage.push(`${archiveTitles.length} standard talk archive${archiveTitles.length === 1 ? "" : "s"} selected from up to 100 subpage titles (maximum ${LIMITS.archives} archives).`);
      if (archives.truncated) result.warnings.push("More archives exist or the archive listing was limited. Older and nonstandard archives have not all been checked.");
    } catch (error) {
      result.complete = false;
      result.warnings.push(`Talk archives could not be checked. ${error.message}`);
    }
    // Prefer people already named in an article-specific notice, then recent editors.
    const linked = result.evidence.flatMap(e => e.coiType === "edit-request-group" && Array.isArray(e.requests)
      ? e.requests.map(request => request.contributor) : [e.contributor]).filter(Boolean);
    try {
      const recent = await client.getRecentContributors(article.title, LIMITS.contributorRevisions);
      users = [...new Set([...linked, ...recent.users])].filter(user => !/[|#<>\[\]{}\u0000-\u001f]/.test(user)).slice(0, LIMITS.userPages);
      result.coverage.push(`User selection: current notices and latest ${LIMITS.contributorRevisions} revisions (maximum ${LIMITS.userPages} pages).`);
    } catch (error) {
      result.complete = false;
      users = [...new Set(linked)].slice(0, LIMITS.userPages);
      result.warnings.push(`Recent contributors could not be checked. ${error.message}`);
    }
    const titles = [...archiveTitles, ...users.map(user => `User:${user}`)];
    if (titles.length) {
      try {
        const extraPages = await client.getPages(titles);
        for (const page of extraPages) {
          if (page.ns === 1 && page.title.startsWith(`Talk:${article.title}/`)) addPage(page, "archive");
          else if (page.ns === 2) addPage(page, "user");
        }
        result.coverage.push(`${extraPages.filter(p => p.ns === 2 && !p.missing && !p.unavailable).length} public user pages checked for templates explicitly naming this article.`);
      } catch (error) {
        result.complete = false;
        result.warnings.push(`Linked sources could not be read. ${error.message}`);
      }
    }
  } else {
    result.coverage.push(UNCHECKED_SOURCES);
  }
  result.coverage.push(HISTORICAL_COVERAGE);
  if (deep) {
    result.deepSummary = `Checked ${checked.archives} talk archive${checked.archives === 1 ? "" : "s"} and ${checked.userPages} user page${checked.userPages === 1 ? "" : "s"}. Requests may be historical and do not establish payment.`;
    result.coverage.push("COI edit requests are grouped by discussion page; request counts are not counts of distinct connected editors.");
  }
  result.evidence = groupCoiRequests([...new Map(result.evidence.map(e => [e.id, e])).values()]);
  const order = { "paid-disclosure": 0, "paid-notice": 1, concern: 2, coi: 3 };
  result.evidence.sort((a, b) => order[a.kind] - order[b.kind]);
  return result;
}
