/**
 * Conservative recognition of English Wikipedia's public disclosure templates.
 *
 * This is a syntactic reader, not a MediaWiki interpreter. It deliberately does
 * not infer payment from prose, account history, an employer's name, or a COI
 * request. Unknown wrappers and parser functions are not evaluated. Source
 * excerpts are plain text and must be rendered with textContent, never HTML.
 */

export const TEMPLATE_ALIASES = Object.freeze({
  // Template-namespace redirects verified against enwiki on 2026-10-30.
  "connected contributor (paid)": "connected contributor (paid)",
  "paid article": "connected contributor (paid)",
  "paid-talk": "connected contributor (paid)",
  "paid contributor": "connected contributor (paid)",
  connpaid: "connected contributor (paid)",
  ccp: "connected contributor (paid)",
  "coi (paid)": "connected contributor (paid)",
  paid: "paid",
  userboxcoipaid: "paid",
  "paid contributions": "paid contributions",
  "paid content": "paid contributions",
  "undisclosed paid": "undisclosed paid",
  udp: "undisclosed paid",
  upe: "undisclosed paid",
  "paid piece": "undisclosed paid",
  "paid push": "undisclosed paid",
  "push piece": "undisclosed paid",
  "paid edit": "undisclosed paid",
  paidedit: "undisclosed paid",
  "paid writeup": "undisclosed paid",
  undisclosed: "undisclosed paid",
  "connected contributor": "connected contributor",
  "connected contributor multi": "connected contributor",
  "connected contributors": "connected contributor",
  "connected editor": "connected contributor",
  connectedcontributor: "connected contributor",
  connected: "connected contributor",
  conn: "connected contributor",
  concon: "connected contributor",
  coi2: "connected contributor",
  "coi-talk": "connected contributor",
  coi: "coi",
  selfpromotion: "coi",
  "coi-section": "coi",
  "coi-check": "coi",
  "coi-issues": "coi",
  "close connection": "coi",
  "coi section": "coi",
  "potential vanity": "coi",
  "close connexion": "coi",
  "conflicts of interest": "coi",
  "coi disclaimer": "coi",
  "edit coi": "edit coi",
  "coi edit request": "edit coi",
  "coi request edit": "edit coi",
  "edit coi-protected": "edit coi",
  "request edit": "edit coi",
  "coi edit": "edit coi",
  coier: "edit coi",
  editcoi: "edit coi",
});

// These wrappers actually display their contained maintenance templates. Do not
// recursively inspect arbitrary arguments: a template may ignore an argument or
// display it as an example, and parser-function branches may not be evaluated.
const TRANSPARENT_WRAPPERS = new Set([
  "multiple issues",
  "multiple problems",
  "article issues",
  "issues",
  "multipleissues",
  "articleissues",
  "multiple",
  "many issues",
  "mi",
  "multi",
  "multissues",
  "multple issues",
  "mult",
  "multiples issues",
  "multiple issue",
  "various issues",
  "mult iss",
  "multiple errors",
  "multi issues",
  "multi issue",
]);

function maskIgnored(source) {
  let masked = source.replace(/<!--[\s\S]*?(?:-->|$)/g, (text) => " ".repeat(text.length));
  const openTag = /<(nowiki|pre|code|syntaxhighlight|source)\b[^>]*>/gi;
  let match;
  while ((match = openTag.exec(masked))) {
    const start = match.index;
    let end = openTag.lastIndex;
    if (!/\/\s*>$/.test(match[0])) {
      const close = new RegExp(`<\\/${match[1]}\\s*>`, "gi");
      close.lastIndex = end;
      const closing = close.exec(masked);
      end = closing ? close.lastIndex : masked.length;
    }
    masked = masked.slice(0, start) + " ".repeat(end - start) + masked.slice(end);
    openTag.lastIndex = end;
  }
  return masked;
}

function readTemplates(source) {
  const masked = maskIgnored(source);
  const stack = [];
  const roots = [];
  for (let index = 0; index < masked.length;) {
    if (masked.startsWith("{{{", index)) {
      stack.push({ type: "argument", start: index, children: [] });
      index += 3;
    } else if (masked.startsWith("{{", index)) {
      stack.push({ type: "template", start: index, children: [] });
      index += 2;
    } else if (masked.startsWith("}}}", index) && stack.at(-1)?.type === "argument") {
      stack.pop(); // Do not interpret an unevaluated argument's default value.
      index += 3;
    } else if (masked.startsWith("}}", index) && stack.at(-1)?.type === "template") {
      const node = stack.pop();
      node.end = index + 2;
      node.raw = source.slice(node.start, node.end);
      node.body = masked.slice(node.start + 2, index);
      (stack.length ? stack.at(-1).children : roots).push(node);
      index += 2;
    } else {
      index += 1;
    }
  }
  return roots;
}

function splitOutsideMarkup(source, separator, firstOnly = false) {
  const pieces = [];
  let curlyDepth = 0;
  let linkDepth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source.startsWith("{{", index)) {
      curlyDepth += 1;
      index += 1;
    } else if (source.startsWith("}}", index)) {
      curlyDepth = Math.max(0, curlyDepth - 1);
      index += 1;
    } else if (source.startsWith("[[", index)) {
      linkDepth += 1;
      index += 1;
    } else if (source.startsWith("]]", index)) {
      linkDepth = Math.max(0, linkDepth - 1);
      index += 1;
    } else if (source[index] === separator && curlyDepth === 0 && linkDepth === 0) {
      pieces.push(source.slice(start, index));
      start = index + 1;
      if (firstOnly) {
        pieces.push(source.slice(start));
        return pieces;
      }
    }
  }
  pieces.push(source.slice(start));
  return pieces;
}

function normalizeTemplateName(name) {
  return name.trim().replace(/_/g, " ").replace(/^template\s*:\s*/i, "")
    .replace(/\s+/g, " ").toLowerCase();
}

function parseTemplate(node) {
  const [rawName, ...fields] = splitOutsideMarkup(node.body, "|");
  const name = normalizeTemplateName(rawName);
  const parameters = Object.create(null);
  let positional = 1;
  for (const field of fields) {
    const assignment = splitOutsideMarkup(field, "=", true);
    if (assignment.length === 2) {
      // Unlike template titles, MediaWiki parameter names are case-sensitive.
      parameters[assignment[0].trim()] = assignment[1].trim();
    } else {
      parameters[String(positional)] = field.trim();
      positional += 1;
    }
  }
  return { name, parameters };
}

function decodeEntities(source) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return source.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, value) => {
    if (!value.startsWith("#")) return named[value.toLowerCase()] ?? entity;
    const number = value[1].toLowerCase() === "x"
      ? Number.parseInt(value.slice(2), 16) : Number.parseInt(value.slice(1), 10);
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : "";
  });
}

function cleanField(source = "", maxLength = 300) {
  let value = maskIgnored(String(source));
  // A few formatting helpers commonly used inside disclosure fields.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = value.replace(/\{\{(?:u|user|user link|nowrap|nobr|small)\s*\|([^{}]+)\}\}/gi,
      (_match, inner) => splitOutsideMarkup(inner, "|")[0].replace(/^1\s*=\s*/, ""));
    if (next === value) break;
    value = next;
  }
  value = value.replace(/\[\[([^\[\]]+)\]\]/g, (_match, inner) => {
    const parts = inner.split("|");
    return parts.length > 1 ? parts.at(-1) : parts[0].replace(/^:/, "");
  });
  value = value.replace(/\[(?:https?:\/\/|\/\/)[^\s\]]+(?:\s+([^\]]*))?\]/gi,
    (_match, label) => label || "");
  value = value.replace(/\{\{[\s\S]*?\}\}/g, "").replace(/<[^>]*>/g, "")
    .replace(/'{2,5}/g, "").replace(/\s+/g, " ").trim();
  return decodeEntities(value).slice(0, maxLength);
}

function cleanContributor(source) {
  const userLink = String(source || "").match(/^\s*\[\[\s*:?(?:User(?: talk)?\s*:\s*)([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]\s*$/i);
  if (userLink) return cleanField(userLink[1]);
  return cleanField(source).replace(/^User(?: talk)?\s*:\s*/i, "").trim();
}

function normalizeArticleTitle(title) {
  const cleaned = decodeEntities(title).replace(/_/g, " ").replace(/^\s*:?(?:en:)?/i, "")
    .replace(/^Talk\s*:\s*/i, "").split("#")[0].replace(/\s+/g, " ").trim();
  // MediaWiki normalizes only the initial letter of an English page title.
  return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : "";
}

function articleTargets(source) {
  const links = [...source.matchAll(/\[\[\s*:?(?:en:)?([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]/gi)]
    .map((match) => normalizeArticleTitle(match[1]));
  if (links.length) return links;
  return source.split(/\r?\n/).map((line) => normalizeArticleTitle(cleanField(line.replace(/^\s*[*#;]+\s*/, ""))))
    .filter(Boolean);
}

function isYes(value) {
  return /^(yes|y|true|1)$/i.test(cleanField(value));
}

function stableId(source) {
  let value = 2166136261;
  for (const character of source) {
    value ^= character.codePointAt(0);
    value = Math.imul(value, 16777619);
  }
  return `evidence-${(value >>> 0).toString(16)}`;
}

function pageSourceUrl(title, revid) {
  if (Number.isSafeInteger(Number(revid)) && Number(revid) > 0) {
    return `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&oldid=${Number(revid)}`;
  }
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function boundedExcerpt(value) {
  const text = String(value).trim();
  return text.slice(0, 600) + (text.length > 600 ? "…" : "");
}

function disclosureUrl(value) {
  try {
    const url = new URL(decodeEntities(value));
    if (url.protocol !== "https:" || url.hostname !== "en.wikipedia.org" || url.port || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

/** Preserve an explicitly linked identity; never guess an employer's article. */
function fieldWikiUrl(source = "") {
  const masked = maskIgnored(String(source));
  const links = [...masked.matchAll(/\[\[\s*([^\[\]|]+)(?:\|[^\]]*)?\]\]/g)];
  if (links.length !== 1) return undefined;
  let target = decodeEntities(links[0][1]).trim().replace(/^:/, "").replace(/^en:/i, "");
  if (!target || /[\u0000-\u001f\u007f<>\[\]{}|]/.test(target)
    || /^(?:\/\/|[a-z][a-z\d+.-]*:\/\/|javascript:|data:|vbscript:|file:)/i.test(target)) return undefined;
  const [page, ...fragmentParts] = target.split("#");
  if (!page.trim()) return undefined;
  // Unknown colon prefixes may be interwiki routes. Leave ambiguous targets to
  // the interface's Wikipedia search fallback instead of following a redirect.
  if (page.includes(":") && !/^(?:User(?: talk)?|Talk|Wikipedia(?: talk)?|Draft(?: talk)?|Special|File(?: talk)?|Category(?: talk)?|Portal(?: talk)?|Help(?: talk)?|Template(?: talk)?|Module(?: talk)?):/i.test(page)) return undefined;
  const fragment = fragmentParts.length ? `#${encodeURIComponent(fragmentParts.join("#").replaceAll(" ", "_"))}` : "";
  return disclosureUrl(`https://en.wikipedia.org/wiki/${encodeURIComponent(page.trim().replaceAll(" ", "_"))}${fragment}`) || undefined;
}

/** Read supporting links without treating them as article-edit attribution. */
function disclosureLinks(source = "") {
  const links = [];
  const seen = new Set();
  const masked = maskIgnored(String(source));
  function add(rawUrl, rawLabel) {
    const url = disclosureUrl(rawUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const suppliedLabel = cleanField(rawLabel || "");
    const label = !suppliedLabel || /^(here|link|this|diff|edit|view|read more)$/i.test(suppliedLabel)
      ? "Disclosure" : suppliedLabel.slice(0, 80);
    links.push({ label, url });
  }
  for (const match of masked.matchAll(/\[\[\s*([^\[\]|]+)(?:\|([^\]]*))?\]\]/g)) {
    let target = decodeEntities(match[1]).trim().replace(/^:/, "").replace(/^en:/i, "");
    if (!target || /[\u0000-\u001f\u007f]/.test(target) || /^(?:\/\/|[a-z][a-z\d+.-]*:\/\/|javascript:|data:|vbscript:|file:)/i.test(target)) continue;
    // Known local namespaces only: avoid interwiki redirects to another site.
    if (target.includes(":") && !/^(?:User(?: talk)?|Talk|Wikipedia(?: talk)?|Draft(?: talk)?|Special):/i.test(target)) continue;
    const [page, ...fragmentParts] = target.split("#");
    const fragment = fragmentParts.length ? `#${encodeURIComponent(fragmentParts.join("#").replaceAll(" ", "_"))}` : "";
    add(`https://en.wikipedia.org/wiki/${encodeURIComponent(page.replaceAll(" ", "_"))}${fragment}`, match[2]);
  }
  for (const match of masked.matchAll(/\[(https?:\/\/[^\s\[\]]+|\/\/[^\s\[\]]+)(?:\s+([^\]]*))?\]/gi)) add(match[1], match[2]);
  for (const match of masked.matchAll(/https:\/\/en\.wikipedia\.org\/[^\s<>{}\[\]]+/gi)) add(match[0].replace(/[.,;]+$/, ""));
  return links;
}

function contributorExcerpt({ contributor, employer, client, note = "" }) {
  const fields = [`Contributor: ${contributor}`];
  if (employer) fields.push(`Employer: ${employer}`);
  if (client && client !== employer) fields.push(`Client: ${client}`);
  if (note.trim()) {
    // Keep this contributor's note readable and bounded, without reproducing the
    // entire multi-contributor template or exposing another contributor's data.
    const cleaned = cleanField(note, 601);
    if (cleaned) fields.push(`Notes: ${cleaned}`);
  }
  return boundedExcerpt(fields.join("\n"));
}

function declaredConnection(value = "") {
  const text = cleanField(value);
  if (/^\d+$/.test(text) && Number.isSafeInteger(Number(text)) && Number(text) > 0) {
    return { status: "declared", links: [{ label: "Declared connection", url: `https://en.wikipedia.org/wiki/Special:Diff/${Number(text)}` }] };
  }
  if (isYes(text)) return { status: "declared", links: [] };
  if (/^(no|n|false|0)$/i.test(text)) return { status: "not-declared", links: [] };
  return { status: "unspecified", links: [] };
}

// Edit COI's A/answered states are intentionally not called "implemented": the
// live template presents those states as answered, which alone is not proof of
// an article revision. D|A is permission to edit, not a declined request.
function coiRequestState(parameters) {
  const mode = cleanField(parameters["1"]).toLowerCase();
  const reasonCode = cleanField(parameters["2"]);
  let status;
  if ((mode === "d" || mode === "declined") && reasonCode !== "A") status = "declined";
  else if (["a", "answered", "ans"].includes(mode)) status = "answered";
  else if (mode === "p") status = "partial";
  else if (mode === "u") status = "under-review";
  else if (mode === "g" || ((mode === "d" || mode === "declined") && reasonCode === "A")) status = "proceed";
  else if (["r", "n", "new", "request"].includes(mode)) status = "open";
  else status = isYes(Object.hasOwn(parameters, "answered") ? parameters.answered : parameters.ans) ? "answered" : "open";
  const reasons = {
    ADV: "The reviewer identified potentially promotional wording.",
    V: "The reviewer requested neutral, independent, reliable sources.",
    O: "The reviewer identified omissions that may affect balance.",
    R: "The request proposed removing sourced material.",
    D: "The reviewer requested discussion with other editors first.",
    A: "The reviewer gave permission to make the proposed edits directly.",
    S: "The reviewer found the request insufficiently specific.",
    T: "The reviewer did not consider the change an improvement.",
    C: "The discussion did not reach consensus.",
    LLM: "The reviewer identified potentially AI-generated content."
  };
  return { status, reason: reasonCode ? reasons[reasonCode] || reasonCode : "" };
}

/**
 * Returns source-backed evidence for the requested article only.
 *
 * A user-page `Paid` declaration must name the article. Merely being a paid
 * editor, or naming an employer that resembles the article, is insufficient.
 * Free-form declarations and substituted/transcluded notices are not interpreted
 * here; callers must disclose that this template-based scan has limited coverage.
 */
export function analyzePage({ title, wikitext, revid, timestamp, role, articleTitle }) {
  if (typeof title !== "string" || typeof wikitext !== "string" || !articleTitle) return [];
  const evidence = [];
  const isTalk = role === "talk" || role === "archive";
  const templates = readTemplates(wikitext);
  const masked = maskIgnored(wikitext);
  const headingCounts = new Map();
  const sections = [...masked.matchAll(/^(={2,6})[\t ]*(.*?)[\t ]*\1[\t ]*$/gm)].map(match => {
    const sectionTitle = cleanField(match[2], 180);
    const duplicate = (headingCounts.get(sectionTitle) || 0) + 1;
    headingCounts.set(sectionTitle, duplicate);
    return { start: match.index, level: match[1].length, title: sectionTitle, anchor: `${sectionTitle.replaceAll(" ", "_")}${duplicate > 1 ? `_${duplicate}` : ""}` };
  });
  const requestPositions = [];
  function collectRequestPositions(node) {
    const { name } = parseTemplate(node);
    if (TEMPLATE_ALIASES[name] === "edit coi") requestPositions.push(node.start);
    node.children.forEach(collectRequestPositions);
  }
  templates.forEach(collectRequestPositions);

  function sectionContext(node) {
    const previous = sections.findLast(section => section.start <= node.start);
    const next = sections.find(section => section.start > node.start);
    let topic = previous;
    while (topic && /^Reply(?:\s|$)/i.test(topic.title)) {
      const parent = sections.findLast(section => section.start < topic.start && section.level < topic.level);
      if (!parent) break;
      topic = parent;
    }
    const sectionUrl = previous?.title
      ? `${pageSourceUrl(title, revid)}#${encodeURIComponent(previous.anchor)}` : pageSourceUrl(title, revid);
    return { sectionTitle: previous?.title || "", topicTitle: topic?.title || "", sectionUrl, end: next?.start ?? masked.length };
  }

  function sectionFields(node) {
    const { sectionTitle, sectionUrl } = sectionContext(node);
    return { sectionTitle, sectionUrl };
  }

  function requestContext(node, context) {
    const followingRequest = requestPositions.find(position => position > node.start);
    let text = masked.slice(node.end, Math.min(context.end, followingRequest ?? masked.length));
    // Stop at a reply instead of presenting another editor's response as the
    // request. The remaining text is still an unattributed discussion excerpt.
    const reply = text.search(/\n[\t ]*:/);
    if (reply >= 0) text = text.slice(0, reply);
    text = text.replace(/^[\t ]*[*#][\t ]*'{0,3}(?:What I think should be changed|Why it should be changed|References supporting the possible change(?:[^\n:]*))'{0,3}:[\t ]*'{0,3}/gim, "");
    return cleanField(text, 350);
  }

  function add(node, item) {
    evidence.push({
      id: stableId(`${title}|${revid || ""}|${node.start}|${item.kind}|${item.contributor || ""}`),
      sourceTitle: title,
      sourceUrl: pageSourceUrl(title, revid),
      sourceRevision: revid || null,
      sourceTimestamp: timestamp || null,
      sourceRole: role,
      sourceTemplate: parseTemplate(node).name,
      excerpt: boundedExcerpt(node.raw.replace(/\s+/g, " ")),
      ...item,
    });
  }

  function visit(node) {
    const { name, parameters: p } = parseTemplate(node);
    const canonical = TEMPLATE_ALIASES[name];
    if (TRANSPARENT_WRAPPERS.has(name)) {
      node.children.forEach(visit);
      return;
    }
    if (!canonical) return;

    if (canonical === "connected contributor (paid)" && isTalk) {
      for (let index = 1; index <= 10; index += 1) {
        const contributor = cleanContributor(p[`User${index}`] || (index === 1 ? p.User || p["1"] : ""));
        if (!contributor) continue;
        const employer = cleanField(p[`U${index}-employer`]);
        const client = cleanField(p[`U${index}-client`]);
        const note = p[`U${index}-otherlinks`] || "";
        const links = disclosureLinks(note);
        const editedHere = cleanField(p[`U${index}-EH`] || (index === 1 ? p.editedhere : ""));
        const summary = isYes(editedHere)
          ? "Paid relationship recorded. Article edits noted; paid revisions not verified."
          : "Paid relationship recorded. Article edits or accepted requests not verified.";
        add(node, {
          kind: "paid-disclosure", heading: "Paid contributor", summary,
          contributor, employer: employer || undefined, client: client || undefined,
          employerUrl: fieldWikiUrl(p[`U${index}-employer`]), clientUrl: fieldWikiUrl(p[`U${index}-client`]),
          note: cleanField(note) || undefined,
          excerpt: contributorExcerpt({ contributor, employer, client, note }),
          ...(links.length ? { disclosureLinks: links } : {}),
          articles: [articleTitle],
          ...(editedHere ? { directEdit: isYes(editedHere) } : {}),
          template: canonical, relationship: "page-notice",
        });
      }
    } else if (canonical === "paid" && role === "user") {
      const rawTargets = [p.article || ""];
      if (isYes(p.userbox) && isYes(p.list)) rawTargets.push(p.articles || "");
      const targets = [...new Set(rawTargets.flatMap(articleTargets))];
      if (!targets.includes(normalizeArticleTitle(articleTitle))) return;
      const owner = cleanContributor(title.replace(/^User(?: talk)?\s*:\s*/i, "").split("/")[0]);
      const contributor = cleanContributor(p.user || owner);
      const employer = cleanField(p.employer);
      const client = cleanField(p.client);
      const summary = "This article is listed as paid work. Paid revisions and surviving text not verified.";
      add(node, {
        kind: "paid-disclosure", heading: "Paid work disclosed", summary,
        contributor, employer: employer || undefined, client: client || undefined,
        employerUrl: fieldWikiUrl(p.employer), clientUrl: fieldWikiUrl(p.client),
        excerpt: contributorExcerpt({ contributor, employer, client }),
        articles: targets, template: canonical,
        relationship: contributor === owner ? "self-disclosed" : "page-notice",
      });
    } else if (canonical === "paid contributions" && role === "article") {
      add(node, {
        kind: "paid-notice", heading: "Paid-content notice",
        summary: "Cleanup notice for disclosed paid contributions; affected revisions not verified.",
        template: canonical, relationship: "page-notice",
      });
    } else if (canonical === "undisclosed paid" && role === "article") {
      add(node, {
        kind: "concern", heading: "Payment concern",
        summary: "Wikipedia editors suspect undisclosed payment. Not independently verified.",
        template: canonical, relationship: "page-notice",
      });
    } else if (canonical === "coi" && role === "article") {
      add(node, {
        kind: "coi", heading: "COI notice",
        summary: "Conflict of interest recorded; payment not established.",
        coiType: "article-notice",
        connection: "The article has a conflict-of-interest cleanup notice; no specific editor or relationship is identified.",
        ...sectionFields(node),
        template: canonical, relationship: "page-notice",
      });
    } else if (canonical === "connected contributor" && isTalk) {
      for (let index = 1; index <= 10; index += 1) {
        const contributor = cleanContributor(p[`User${index}`] || (index === 1 ? p.User || p.user || p["1"] : ""));
        if (!contributor) continue;
        const note = p[`U${index}-otherlinks`] || (index === 1 ? p.otherlinks || "" : "");
        const declared = declaredConnection(p[`U${index}-declared`] || (index === 1 ? p.declared : ""));
        const links = [...new Map([...declared.links, ...disclosureLinks(note)].map(link => [link.url, link])).values()];
        const cleanedNote = cleanField(note);
        const connection = cleanedNote ? `The notice says: ${cleanedNote}` : declared.status === "declared"
          ? "A connection is declared; the notice does not specify the relationship."
          : "The notice lists a possible personal or professional connection; no relationship is specified.";
        add(node, {
          kind: "coi", heading: "Connected contributor",
          summary: "Connection to the subject recorded; payment not established.",
          coiType: "connected-contributor", connection, declarationStatus: declared.status,
          note: cleanedNote || undefined,
          ...sectionFields(node),
          contributor, template: canonical, relationship: "page-notice",
          excerpt: contributorExcerpt({ contributor, note }),
          ...(links.length ? { disclosureLinks: links } : {}),
        });
      }
    } else if (canonical === "edit coi" && isTalk) {
      const context = sectionContext(node);
      const request = coiRequestState(p);
      add(node, {
        kind: "coi", heading: "COI edit request",
        summary: "Payment and implementation not established, even when marked answered.",
        coiType: "edit-request",
        connection: "A contributor used the conflict-of-interest edit-request process. The request alone does not establish payment or the specific relationship.",
        sectionTitle: context.sectionTitle, sectionUrl: context.sectionUrl,
        topicTitle: context.topicTitle,
        requestSummary: cleanField(p.summary) || context.topicTitle || context.sectionTitle || "COI edit request",
        requestSummaryExplicit: Boolean(cleanField(p.summary)),
        requestStatus: request.status,
        ...(request.reason ? { requestReason: request.reason } : {}),
        contextExcerpt: requestContext(node, context),
        template: canonical, relationship: "page-notice",
      });
    }
  }

  templates.forEach(visit);
  return evidence;
}
