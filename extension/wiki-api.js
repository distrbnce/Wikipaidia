export const API_ENDPOINT = "https://en.wikipedia.org/w/api.php";
export const CLIENT_ID = "Wikipaidia/0.11 (+https://github.com/distrbnce/Wikipaidia; public disclosure reader)";
export const ARTICLE_DIFF_TEXT_LIMIT = 20000;

export class WikiApiError extends Error {
  constructor(message, code = "api-error") {
    super(message);
    this.name = "WikiApiError";
    this.code = code;
  }
}

const defaultSleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/** A single scheduler is shared by all tabs and client instances in this worker. */
export function createRequestScheduler({ maxConcurrent = 3, minIntervalMs = 400, now = Date.now, sleep = defaultSleep } = {}) {
  const queue = [];
  let active = 0;
  let nextStart = 0;
  let cooldownUntil = 0;
  let pumping = false;

  function cooldownError() {
    const seconds = Math.max(1, Math.ceil((cooldownUntil - now()) / 1000));
    return new WikiApiError(`Wikipedia is limiting requests. Try again in ${seconds} seconds.`, "rate-limited");
  }

  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length && active < maxConcurrent) {
        if (now() < cooldownUntil) {
          while (queue.length) queue.shift().reject(cooldownError());
          break;
        }
        const wait = nextStart - now();
        if (wait > 0) {
          await sleep(wait);
          continue;
        }
        const job = queue.shift();
        active += 1;
        nextStart = now() + minIntervalMs;
        Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => {
          active -= 1;
          void pump();
        });
      }
    } catch (error) {
      while (queue.length) queue.shift().reject(error);
    } finally {
      pumping = false;
      if (queue.length && active < maxConcurrent) void pump();
    }
  }

  return {
    run(task) {
      if (now() < cooldownUntil) return Promise.reject(cooldownError());
      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        void pump();
      });
    },
    cooldown(milliseconds) {
      cooldownUntil = Math.max(cooldownUntil, now() + milliseconds);
      // Do not leave scans queued for a server-requested wait. They can be retried
      // explicitly when the cooldown expires, without holding message channels.
      while (queue.length) queue.shift().reject(cooldownError());
      return cooldownError();
    }
  };
}

const sharedScheduler = createRequestScheduler();

function retryAfterMilliseconds(header, now) {
  if (typeof header === "string" && /^\s*\d+(?:\.\d+)?\s*$/.test(header)) {
    const milliseconds = Number(header) * 1000;
    if (Number.isFinite(milliseconds)) return Math.max(1000, milliseconds);
  }
  const date = typeof header === "string" ? Date.parse(header) : NaN;
  return Number.isFinite(date) ? Math.max(1000, date - now) : 30000;
}

function invalidResponse(message = "Wikipedia returned an unexpected response.") {
  return new WikiApiError(message, "invalid-response");
}

function incompleteResponse() {
  return new WikiApiError("Wikipedia returned only part of the requested source data. This check could not be completed.", "incomplete-response");
}

const lookupTitle = title => title.replaceAll("_", " ").trim();
const hasFlag = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function normalizeIdentity(value) {
  const normalized = lookupTitle(value);
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "";
}

function validateEditLookup(title, contributor) {
  for (const value of [title, contributor]) {
    if (typeof value !== "string" || !value.trim() || value.length > 255 || /[\u0000-\u001f\u007f|#<>\[\]{}]/.test(value)) {
      throw invalidResponse("An article title and contributor are required.");
    }
  }
}

function revisionContinuation(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    || Object.keys(value).some(key => key !== "rvcontinue" && key !== "continue")
    || !hasFlag(value, "rvcontinue") || typeof value.rvcontinue !== "string" || !value.rvcontinue || value.rvcontinue.length > 2048
    || /[\u0000-\u001f\u007f]/.test(value.rvcontinue)
    || (value.continue !== undefined && (typeof value.continue !== "string"
      || value.continue.length > 100 || /[\u0000-\u001f\u007f]/.test(value.continue)))) {
    throw invalidResponse("Wikipedia returned an invalid article-history continuation.");
  }
  return { ...(value.continue !== undefined ? { continue: value.continue } : {}), rvcontinue: value.rvcontinue };
}

function revisionDiffUrl(title, revid, parentid) {
  return parentid === 0
    ? `https://en.wikipedia.org/wiki/Special:Diff/${revid}`
    : `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&diff=${revid}&oldid=${parentid}`;
}

function articleRevision(page, revision, contributor) {
  if (!revision || !Number.isSafeInteger(revision.revid) || revision.revid <= 0
    || !Number.isSafeInteger(revision.parentid) || revision.parentid < 0 || revision.parentid >= revision.revid
    || typeof revision.timestamp !== "string" || !Number.isFinite(Date.parse(revision.timestamp))
    || typeof revision.user !== "string" || hasFlag(revision, "userhidden")
    || normalizeIdentity(revision.user) !== normalizeIdentity(contributor)) {
    throw invalidResponse("Wikipedia could not verify this article edit's author and revision.");
  }
  return {
    revid: revision.revid, parentid: revision.parentid, timestamp: revision.timestamp, user: revision.user,
    comment: !hasFlag(revision, "commenthidden") && typeof revision.comment === "string" ? revision.comment.slice(0, 1000) : "",
    diffUrl: revisionDiffUrl(page.title, revision.revid, revision.parentid),
  };
}

function decodeHtmlEntities(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, name) => {
    if (!name.startsWith("#")) return entities[name.toLowerCase()] ?? match;
    const number = /^#x/i.test(name) ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    return Number.isInteger(number) && number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number) : "\ufffd";
  });
}

function appendRange(ranges, start, end) {
  if (end <= start) return;
  const last = ranges.at(-1);
  if (last && last.end >= start) last.end = Math.max(last.end, end);
  else ranges.push({ start, end });
}

function clipRanges(ranges, length) {
  const clipped = [];
  for (const range of ranges) appendRange(clipped, Math.min(range.start, length), Math.min(range.end, length));
  return clipped;
}

function clippedSourceText(text, maxLength) {
  const clipped = text.slice(0, maxLength);
  const last = clipped.charCodeAt(clipped.length - 1);
  const next = text.charCodeAt(clipped.length);
  return last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
    ? clipped.slice(0, -1) : clipped;
}

function diffCellText(html) {
  // The result is always plain source text. No API-supplied HTML is sent to the
  // interface for interpretation; encoded source markup remains inert text.
  return decodeHtmlEntities(html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(?:div|p)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")).replace(/\r\n?/g, "\n").replace(/\n+$/, "");
}

function blockReasonSource(reason) {
  let text = diffCellText(reason);
  // Remove template calls instead of guessing the rendered template's meaning.
  // Repeat only while consuming nested braces; the source has a fixed bound.
  let previous;
  do {
    previous = text;
    text = text.replace(/\{\{[^{}]*\}\}/g, "");
  } while (text !== previous);
  return text;
}

function blockReasonText(reason) {
  // Block reasons are wikitext, not trusted HTML. Retain the recorded wording
  // and link labels without interpreting templates or creating HTML/link sinks.
  return blockReasonSource(reason)
    .replace(/\[\[([^\[\]]+)\]\]/g, (_, link) => {
      const parts = link.split("|");
      return parts.at(-1).replace(/^:?(?:w:)?en:/i, "");
    })
    .replace(/\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]/g, (_, url, label) => label || url)
    .replace(/'{2,5}/g, "").replace(/\s+/g, " ").replace(/^\s*[:;–—-]\s*/, "").trim();
}

function blockReasonLink(link) {
  if (link.startsWith("[[")) {
    let target = link.slice(2, -2).split("|")[0].trim().replace(/^:/, "");
    target = target.replace(/^(?:w:)?en:/i, "");
    if (!target || target.length > 255 || /[\u0000-\u001f\u007f<>\[\]{}|]/.test(target)) return null;
    const [title, ...fragment] = target.split("#");
    if (!title.trim()) return null;
    // Unknown colon prefixes may be interwiki destinations. Keep extraction
    // conservative instead of guessing that another wiki is a local page.
    const namespace = title.includes(":") ? title.split(":")[0].replaceAll("_", " ").toLowerCase() : "";
    const localNamespaces = new Set(["talk", "user", "user talk", "wikipedia", "wikipedia talk", "project", "project talk", "wp", "wt", "help", "help talk", "template", "template talk", "category", "category talk", "file", "file talk", "image", "image talk", "mediawiki", "mediawiki talk", "special", "media", "portal", "portal talk", "draft", "draft talk", "module", "module talk", "timedtext", "timedtext talk"]);
    if (namespace && !localNamespaces.has(namespace)) return null;
    const path = encodeURIComponent(title.trim().replaceAll(" ", "_")).replaceAll("%3A", ":").replaceAll("%2F", "/");
    const hash = fragment.length ? `#${encodeURIComponent(fragment.join("#").replaceAll(" ", "_"))}` : "";
    return `https://en.wikipedia.org/wiki/${path}${hash}`;
  }
  const external = link.match(/^\[(https:\/\/[^\s\]]+)(?:\s+[^\]]*)?\]$/i);
  if (!external) return null;
  try {
    const url = new URL(external[1]);
    return url.protocol === "https:" && url.hostname === "en.wikipedia.org" && !url.port && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function blockReasonEvidence(reason) {
  const text = blockReasonText(reason) || "No plain-text reason provided.";
  const source = blockReasonSource(reason);
  // Only replace a complete final "Please see:" citation. Other wording,
  // unsafe targets, and ambiguous citations remain visible as recorded text.
  const citation = source.match(/\bPlease\s+see\s*:\s*(\[\[[^\[\]]+\]\]|\[https:\/\/[^\]\r\n]+\])\s*[.!]?\s*$/i);
  if (!citation) return { reason: text };
  const reasonUrl = blockReasonLink(citation[1]);
  const summary = blockReasonText(source.slice(0, citation.index)).replace(/\s*[:;–—-]\s*$/, "").trim();
  return reasonUrl && summary ? { reason: summary, reasonUrl } : { reason: text };
}

/** Refine word-sized MediaWiki changes to exact inserted/deleted characters. */
function characterHighlights(before, after) {
  // Work on original text before display clipping, so an insertion does not
  // create a fake deletion at the end of a shortened preview. Use code points so
  // a changed emoji never highlights only half of a UTF-16 surrogate pair.
  const left = Array.from(before), right = Array.from(after);
  let prefix = 0, suffix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix++;
  while (suffix < left.length - prefix && suffix < right.length - prefix
    && left[left.length - suffix - 1] === right[right.length - suffix - 1]) suffix++;
  const a = left.slice(prefix, left.length - suffix), b = right.slice(prefix, right.length - suffix);
  // Large unrelated rewrites can exceed an interactive preview's work budget.
  // Omit exact ranges rather than inventing a broad "changed" span containing
  // unchanged text; the full Wikipedia comparison remains linked.
  if ((a.length + 1) * (b.length + 1) > 2_500_000) return { beforeRanges: [], afterRanges: [], limited: true };
  const base = left.slice(0, prefix).join("").length;
  const aOffsets = [base], bOffsets = [base];
  for (const value of a) aOffsets.push(aOffsets.at(-1) + value.length);
  for (const value of b) bOffsets.push(bOffsets.at(-1) + value.length);
  const width = b.length + 1;
  const lengths = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    lengths[i * width + j] = a[i] === b[j] ? lengths[(i + 1) * width + j + 1] + 1
      : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
  }
  const beforeRanges = [], afterRanges = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; }
    else if (i < a.length && (j === b.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
      appendRange(beforeRanges, aOffsets[i], aOffsets[i + 1]); i++;
    } else { appendRange(afterRanges, bOffsets[j], bOffsets[j + 1]); j++; }
  }
  return { beforeRanges, afterRanges, limited: false };
}

/** Read only changed cells from MediaWiki's table diff, without a DOM/HTML sink. */
export function parseDiffHtml(html, { maxChanges = 20, maxTextLength = 1500 } = {}) {
  if (typeof html !== "string") throw invalidResponse("Wikipedia returned no readable edit comparison.");
  const changes = [];
  let truncated = false;
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    let before = null;
    let after = null;
    for (const cell of row[1].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]\s*>/gi)) {
      const classes = cell[1].match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const tokens = (classes?.[1] ?? classes?.[2] ?? classes?.[3] ?? "").split(/\s+/);
      if (tokens.includes("diff-deletedline")) before = diffCellText(cell[2]);
      if (tokens.includes("diff-addedline")) after = diffCellText(cell[2]);
    }
    // Context, line numbers, and separator rows do not imply changed source.
    if (before === null && after === null) continue;
    if (changes.length >= maxChanges) { truncated = true; continue; }
    before ??= "";
    after ??= "";
    if (before.length > maxTextLength || after.length > maxTextLength) truncated = true;
    const change = { before: clippedSourceText(before, maxTextLength), after: clippedSourceText(after, maxTextLength) };
    const highlights = characterHighlights(before, after);
    truncated ||= highlights.limited;
    const beforeRanges = clipRanges(highlights.beforeRanges, change.before.length);
    const afterRanges = clipRanges(highlights.afterRanges, change.after.length);
    if (beforeRanges.length) change.beforeHighlights = beforeRanges;
    if (afterRanges.length) change.afterHighlights = afterRanges;
    changes.push(change);
  }
  return { changes, truncated };
}

/** Validate source identities using API normalization/redirect metadata, not guesses. */
function pageResults(data, requestedTitles, { allowContinuation = false } = {}) {
  if (!allowContinuation && data.continue) throw incompleteResponse();
  const pages = data.query.pages;
  if (!Array.isArray(pages) || !pages.length) throw invalidResponse("Wikipedia returned no page data.");
  const redirects = new Map();
  for (const key of ["normalized", "converted", "redirects"]) {
    if (data.query[key] !== undefined && !Array.isArray(data.query[key])) throw invalidResponse();
    for (const entry of data.query[key] ?? []) {
      if (typeof entry?.from !== "string" || typeof entry?.to !== "string") throw invalidResponse();
      redirects.set(lookupTitle(entry.from), lookupTitle(entry.to));
    }
  }
  const expected = new Set(requestedTitles.map(title => {
    let current = lookupTitle(title);
    const visited = new Set();
    while (redirects.has(current)) {
      if (visited.has(current)) throw incompleteResponse();
      visited.add(current);
      const next = redirects.get(current);
      if (next === current) break;
      current = next;
    }
    return current;
  }));
  const returned = new Set();
  for (const page of pages) {
    // ns must come from Wikipedia. Inferring namespace 0 from a title would allow
    // a non-article source to be treated as an article by the scanner.
    if (!page || typeof page.title !== "string" || !Number.isInteger(page.ns)) throw invalidResponse();
    const title = lookupTitle(page.title);
    if (!expected.has(title)) throw incompleteResponse();
    returned.add(title);
  }
  if ([...expected].some(title => !returned.has(title))) throw incompleteResponse();
  return pages;
}

/** Only reads the public English Wikipedia API. Never sends login credentials. */
export function createWikiClient({ fetchImpl = globalThis.fetch, timeoutMs = 12000, scheduler = sharedScheduler, now = Date.now } = {}) {
  async function requestAction(action, parameters = {}) {
    // Only these two explicitly selected read actions may reach the network.
    if (action !== "query" && action !== "compare") throw invalidResponse();
    const url = new URL(API_ENDPOINT);
    const params = { ...parameters, action, format: "json", formatversion: "2", origin: "*" };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    return scheduler.run(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url.href, {
          method: "GET", credentials: "omit", referrerPolicy: "no-referrer", redirect: "error",
          headers: { "Api-User-Agent": CLIENT_ID }, signal: controller.signal
        });
        if (response.status === 429 || response.status === 503) {
          const delay = retryAfterMilliseconds(response.headers?.get("Retry-After"), now());
          throw scheduler.cooldown(delay);
        }
        if (!response.ok) throw new WikiApiError(`Wikipedia returned HTTP ${response.status}.`, "http-error");
        let data;
        try { data = await response.json(); }
        catch { throw invalidResponse("Wikipedia returned unreadable page data."); }
        if (!data || typeof data !== "object" || Array.isArray(data)) throw invalidResponse();
        if (data.error) throw new WikiApiError("Wikipedia could not complete this check. Please try again later.", data.error.code || "api-error");
        if (data.warnings && Object.keys(data.warnings).length) throw incompleteResponse();
        if (!data[action] || typeof data[action] !== "object" || Array.isArray(data[action])) throw invalidResponse();
        return data;
      } catch (error) {
        if (error instanceof WikiApiError) throw error;
        if (error?.name === "AbortError") throw new WikiApiError("Wikipedia took too long to respond. Please try again.", "timeout");
        throw new WikiApiError("Could not reach Wikipedia. Check your connection and try again.", "network-error");
      } finally { clearTimeout(timer); }
    });
  }

  const request = parameters => requestAction("query", parameters);

  async function getUserBlockStatus(contributor) {
    if (typeof contributor !== "string" || !contributor.trim() || contributor.length > 255
      || /[\u0000-\u001f\u007f|#<>\[\]{}]/.test(contributor)) {
      throw invalidResponse("A valid contributor is required.");
    }
    const data = await request({ list: "users", ususers: lookupTitle(contributor), usprop: "blockinfo" });
    if (data.continue) throw incompleteResponse();
    const users = data.query.users;
    if (!Array.isArray(users) || users.length !== 1 || !users[0] || typeof users[0] !== "object" || Array.isArray(users[0])) {
      throw invalidResponse("Wikipedia returned no reliable account status.");
    }
    const account = users[0];
    if (typeof account.name !== "string" || normalizeIdentity(account.name) !== normalizeIdentity(contributor)) {
      throw invalidResponse("Wikipedia returned a different contributor's account status.");
    }
    const blockFields = ["blockid", "blockedby", "blockreason", "blockexpiry", "blockedtimestamp", "blockpartial"];
    const hasBlockInfo = blockFields.some(key => hasFlag(account, key));
    if (hasFlag(account, "missing") || hasFlag(account, "invalid")) {
      if (hasBlockInfo) throw invalidResponse("Wikipedia returned inconsistent account status.");
      // The users module marks IP addresses invalid too. This must not be
      // presented as a claim that the IP has no applicable block.
      return { user: account.name, blocked: false, exists: false };
    }
    if (!Number.isSafeInteger(account.userid) || account.userid <= 0) throw invalidResponse("Wikipedia returned no reliable account status.");
    if (!hasBlockInfo) return { user: account.name, blocked: false, exists: true };
    const validTimestamp = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && Number.isFinite(Date.parse(value));
    if (!Number.isSafeInteger(account.blockid) || account.blockid <= 0
      || typeof account.blockreason !== "string" || account.blockreason.length > 20000
      || !(account.blockexpiry === "infinite" || account.blockexpiry === "infinity" || validTimestamp(account.blockexpiry))
      || (account.blockedby !== undefined && (typeof account.blockedby !== "string" || !account.blockedby.trim() || account.blockedby.length > 255))
      || (account.blockedtimestamp !== undefined && !validTimestamp(account.blockedtimestamp))
      || (account.blockpartial !== undefined && typeof account.blockpartial !== "boolean")) {
      throw invalidResponse("Wikipedia returned incomplete block information.");
    }
    const logUrl = new URL("https://en.wikipedia.org/w/index.php");
    logUrl.searchParams.set("title", "Special:Log");
    logUrl.searchParams.set("type", "block");
    logUrl.searchParams.set("page", `User:${account.name}`);
    return {
      user: account.name, blocked: true, exists: true,
      block: {
        id: account.blockid,
        ...(account.blockedby !== undefined ? { by: account.blockedby } : {}),
        ...blockReasonEvidence(account.blockreason), expiry: account.blockexpiry,
        ...(account.blockedtimestamp !== undefined ? { timestamp: account.blockedtimestamp } : {}),
        partial: account.blockpartial === true, logUrl: logUrl.href,
      },
    };
  }

  async function getPages(titles) {
    if (!Array.isArray(titles) || titles.some(title => typeof title !== "string" || !title.trim())) throw invalidResponse("A valid source title is required.");
    if (!titles.length) return [];
    if (titles.length > 50) throw new WikiApiError("Too many source pages were requested at once.", "too-many-pages");
    const requested = [...new Set(titles)];
    const data = await request({ prop: "revisions", titles: requested.join("|"), rvprop: "ids|timestamp|content", rvslots: "main", redirects: 1 });
    return pageResults(data, requested).map(page => {
      const revision = page.revisions?.[0];
      const slot = revision?.slots?.main;
      const missing = hasFlag(page, "missing") || hasFlag(page, "invalid");
      return {
        title: page.title, ns: page.ns, missing,
        revid: revision?.revid, timestamp: revision?.timestamp,
        wikitext: typeof slot?.content === "string" ? slot.content : "",
        unavailable: !missing && (!revision || typeof slot?.content !== "string"
          || !Number.isSafeInteger(revision.revid) || revision.revid <= 0
          || typeof revision.timestamp !== "string" || !Number.isFinite(Date.parse(revision.timestamp)))
      };
    });
  }

  async function getRecentContributors(title, limit = 50) {
    if (typeof title !== "string" || !title.trim() || !Number.isInteger(limit) || limit < 1 || limit > 500) throw invalidResponse("Valid contributor lookup parameters are required.");
    const data = await request({ prop: "revisions", titles: title, rvprop: "user|userid", rvlimit: limit, redirects: 1 });
    const [page] = pageResults(data, [title], { allowContinuation: true });
    if (page.ns !== 0 || hasFlag(page, "missing") || hasFlag(page, "invalid") || !Array.isArray(page.revisions)) throw invalidResponse("Wikipedia returned no article contributor data.");
    const users = page.revisions.filter(revision => revision && Number.isSafeInteger(revision.userid)
      && revision.userid > 0 && !hasFlag(revision, "userhidden")
      && typeof revision.user === "string" && revision.user.trim()
      && !/^~\d{4}[-/]/.test(revision.user) && !revision.temp && !revision.temporary)
      .map(revision => revision.user);
    return { users: [...new Set(users)], hasMore: Boolean(data.continue) };
  }

  async function getArchiveTitles(title, limit = 5) {
    if (typeof title !== "string" || !title.trim() || !Number.isInteger(limit) || limit < 1 || limit > 100) throw invalidResponse("Valid archive lookup parameters are required.");
    // List up to 100 titles under the talk page, then choose numeric archives.
    // The bound is explicit; nonstandard archive locations remain out of scope.
    const prefix = `${title}/`;
    const data = await request({ list: "allpages", apnamespace: 1, apprefix: prefix, aplimit: 100 });
    if (!Array.isArray(data.query.allpages) || data.query.allpages.some(page => !page || page.ns !== 1 || typeof page.title !== "string" || !lookupTitle(page.title).startsWith(`Talk:${lookupTitle(prefix)}`))) throw invalidResponse("Wikipedia returned invalid archive data.");
    const candidates = data.query.allpages.map(page => page.title).filter(value => /\/(?:Archive(?:s)?[ _]?(?:\d+|[A-Za-z]+[ _]\d{4})|\d{4}(?:\/\d{1,2})?)$/i.test(value));
    candidates.sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
    return { titles: candidates.slice(0, limit), truncated: Boolean(data.continue) || candidates.length > limit };
  }

  async function getContributorEdits(title, contributor, limit = 10) {
    validateEditLookup(title, contributor);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw invalidResponse("The article edit limit is invalid.");
    const data = await request({ prop: "revisions", titles: title, rvuser: contributor,
      rvprop: "ids|timestamp|user|comment", rvlimit: limit, redirects: 1 });
    const [page] = pageResults(data, [title], { allowContinuation: true });
    if (page.ns !== 0 || hasFlag(page, "missing") || hasFlag(page, "invalid")) throw invalidResponse("Article edits are unavailable for this page.");
    // A filtered revisions query omits this property when the user has no edits.
    if (page.revisions !== undefined && !Array.isArray(page.revisions)) throw invalidResponse();
    const revisions = page.revisions ?? [];
    if (revisions.length > limit) throw incompleteResponse();
    return { edits: revisions.map(revision => articleRevision(page, revision, contributor)), hasMore: Boolean(data.continue) };
  }

  /** Fetch matching metadata in bounded chunks; never invent a total for partial history. */
  async function getAllContributorEdits(title, contributor, options = {}) {
    validateEditLookup(title, contributor);
    if (!options || typeof options !== "object" || Array.isArray(options)) throw invalidResponse("Valid article-history options are required.");
    const { continuation = null, maxPages = 20 } = options;
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20) throw invalidResponse("The article-history page limit is invalid.");
    let next = revisionContinuation(continuation);
    const resumed = Boolean(next);
    const seen = new Set(next ? [JSON.stringify(next)] : []);
    const edits = new Map();
    let canonicalTitle = null;
    let pageId = null;

    for (let index = 0; index < maxPages; index++) {
      const data = await request({ prop: "revisions", titles: canonicalTitle || title, rvuser: contributor,
        rvprop: "ids|timestamp|user|comment", rvlimit: 500, rvdir: "older", redirects: 1, ...(next || {}) });
      const [page] = pageResults(data, [canonicalTitle || title], { allowContinuation: true });
      if (page.ns !== 0 || hasFlag(page, "missing") || hasFlag(page, "invalid")) throw invalidResponse("Article edits are unavailable for this page.");
      if (canonicalTitle !== null && normalizeIdentity(page.title) !== normalizeIdentity(canonicalTitle)) throw incompleteResponse();
      canonicalTitle = page.title;
      if (pageId !== null && page.pageid === undefined) throw incompleteResponse();
      if (page.pageid !== undefined) {
        if (!Number.isSafeInteger(page.pageid) || page.pageid <= 0 || (pageId !== null && pageId !== page.pageid)) throw incompleteResponse();
        pageId = page.pageid;
      }
      if (page.revisions !== undefined && !Array.isArray(page.revisions)) throw invalidResponse();
      const revisions = page.revisions ?? [];
      if (revisions.length > 500) throw incompleteResponse();
      for (const revision of revisions) {
        const edit = articleRevision(page, revision, contributor);
        const previous = edits.get(edit.revid);
        if (previous && (previous.parentid !== edit.parentid || previous.timestamp !== edit.timestamp || previous.user !== edit.user)) throw incompleteResponse();
        edits.set(edit.revid, edit);
      }
      next = data.continue === undefined ? null : revisionContinuation(data.continue);
      if (!next) break;
      const signature = JSON.stringify(next);
      if (seen.has(signature)) throw incompleteResponse();
      seen.add(signature);
    }

    const ordered = [...edits.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || b.revid - a.revid);
    return {
      edits: ordered, hasMore: Boolean(next),
      // A resumed call cannot know how many revisions an earlier call returned.
      // Callers combine chunks and count the unique edits after the terminal page.
      totalCount: !next && !resumed ? ordered.length : null,
      continuation: next,
    };
  }

  async function getArticleEditDiff(title, contributor, revid) {
    validateEditLookup(title, contributor);
    if (!Number.isSafeInteger(revid) || revid <= 0) throw invalidResponse("A valid article revision is required.");
    const data = await request({ prop: "revisions", revids: revid, rvprop: "ids|timestamp|user|comment" });
    const [page] = pageResults(data, [title]);
    if (page.ns !== 0 || hasFlag(page, "missing") || hasFlag(page, "invalid") || !Array.isArray(page.revisions) || page.revisions.length !== 1) {
      throw invalidResponse("The article revision is unavailable.");
    }
    const edit = articleRevision(page, page.revisions[0], contributor);
    if (edit.revid !== revid) throw invalidResponse("Wikipedia returned a different article revision.");
    if (edit.parentid === 0) {
      // Initial creation has no parent. Read its exact source rather than letting
      // oldid=0 or a relative comparison accidentally select a current revision.
      const content = await request({ prop: "revisions", revids: revid, rvprop: "ids|timestamp|user|comment|content", rvslots: "main" });
      const [creationPage] = pageResults(content, [page.title]);
      if (creationPage.ns !== 0 || !Array.isArray(creationPage.revisions) || creationPage.revisions.length !== 1) throw invalidResponse();
      const creation = articleRevision(creationPage, creationPage.revisions[0], contributor);
      const source = creationPage.revisions[0].slots?.main?.content;
      if (creation.revid !== revid || creation.parentid !== 0 || typeof source !== "string" || hasFlag(creationPage.revisions[0], "texthidden")) {
        throw invalidResponse("The original article source is unavailable.");
      }
      const preview = clippedSourceText(source, ARTICLE_DIFF_TEXT_LIMIT);
      return { ...edit, changes: preview ? [{ before: "", after: preview, afterHighlights: [{ start: 0, end: preview.length }] }] : [], truncated: source.length > preview.length };
    }
    const comparison = await requestAction("compare", { fromrev: edit.parentid, torev: edit.revid, prop: "diff|ids|title", difftype: "table" });
    const diff = comparison.compare;
    if (diff.fromrevid !== edit.parentid || diff.torevid !== edit.revid || diff.fromns !== 0 || diff.tons !== 0
      || typeof diff.fromtitle !== "string" || typeof diff.totitle !== "string"
      || normalizeIdentity(diff.fromtitle) !== normalizeIdentity(page.title) || normalizeIdentity(diff.totitle) !== normalizeIdentity(page.title)
      || hasFlag(diff, "fromtexthidden") || hasFlag(diff, "totexthidden")) {
      throw invalidResponse("Wikipedia could not verify this article comparison.");
    }
    const parsed = parseDiffHtml(diff.body ?? diff["*"], { maxTextLength: ARTICLE_DIFF_TEXT_LIMIT });
    return { ...edit, ...parsed };
  }

  return { request, getPages, getRecentContributors, getArchiveTitles, getContributorEdits, getAllContributorEdits, getArticleEditDiff, getUserBlockStatus };
}
