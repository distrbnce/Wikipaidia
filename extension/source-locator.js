(() => {
  "use strict";
  if (globalThis.WikipaidiaSource) return;

  const ORIGIN = "https://en.wikipedia.org";
  const MARKER = "#wikipaidia-source=";
  const MAX_PAYLOAD = 4096;
  const NOTICE = ".tmbox,.ambox,.ombox,.fmbox,.imbox,.cmbox,.userbox,table.metadata,.editrequest";
  const aliases = Object.freeze({
    "connected contributor (paid)": "connected contributor (paid)", "paid article": "connected contributor (paid)",
    "paid-talk": "connected contributor (paid)", "paid contributor": "connected contributor (paid)",
    connpaid: "connected contributor (paid)", ccp: "connected contributor (paid)", "coi (paid)": "connected contributor (paid)",
    paid: "paid", userboxcoipaid: "paid", "paid contributions": "paid contributions", "paid content": "paid contributions",
    "undisclosed paid": "undisclosed paid", udp: "undisclosed paid", upe: "undisclosed paid", "paid piece": "undisclosed paid",
    "paid push": "undisclosed paid", "push piece": "undisclosed paid", "paid edit": "undisclosed paid", paidedit: "undisclosed paid",
    "paid writeup": "undisclosed paid", undisclosed: "undisclosed paid",
    "connected contributor": "connected contributor", "connected contributor multi": "connected contributor",
    "connected contributors": "connected contributor", "connected editor": "connected contributor", connectedcontributor: "connected contributor",
    connected: "connected contributor", conn: "connected contributor", concon: "connected contributor", coi2: "connected contributor",
    "coi-talk": "connected contributor", coi: "coi", selfpromotion: "coi", "coi-section": "coi", "coi-check": "coi",
    "coi-issues": "coi", "close connection": "coi", "coi section": "coi", "potential vanity": "coi",
    "close connexion": "coi", "conflicts of interest": "coi", "coi disclaimer": "coi",
    "edit coi": "edit coi", "coi edit request": "edit coi", "coi request edit": "edit coi", "edit coi-protected": "edit coi",
    "request edit": "edit coi", "coi edit": "edit coi", coier: "edit coi", editcoi: "edit coi"
  });
  const kinds = Object.freeze({
    "paid-disclosure": ["connected contributor (paid)", "paid"], "paid-notice": ["paid contributions"],
    concern: ["undisclosed paid"], coi: ["connected contributor", "coi", "edit coi"]
  });
  const highlighted = new Set();
  let observer;
  let observerTimer;
  let observerGeneration = 0;

  const spaces = value => value.replace(/[_\u00a0\s]+/g, " ").trim();
  const decode = value => { try { return decodeURIComponent(value); } catch { return value; } };
  const firstUpper = value => value ? value[0].toUpperCase() + value.slice(1) : "";
  function pageName(value) {
    const normalized = spaces(value);
    const namespace = normalized.match(/^(Talk|User|User talk|Wikipedia|Wikipedia talk|File|File talk|Template|Template talk|Help|Help talk|Category|Category talk|Portal|Portal talk|Draft|Draft talk|Module|Module talk|MediaWiki|MediaWiki talk):\s*/i);
    return namespace ? `${namespace[1].toLowerCase()}:${firstUpper(normalized.slice(namespace[0].length))}` : firstUpper(normalized);
  }
  const accountName = value => firstUpper(spaces(value));

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.origin === ORIGIN && !url.username && !url.password ? url : null;
    } catch { return null; }
  }

  function titleFromUrl(url) {
    if (url.pathname === "/w/index.php") return url.searchParams.get("title") || "";
    if (url.pathname.startsWith("/wiki/")) return decode(url.pathname.slice(6));
    return "";
  }

  function readUrl(url) {
    return (url.pathname.startsWith("/wiki/") || url.pathname === "/w/index.php") &&
      (!url.searchParams.has("action") || url.searchParams.get("action") === "view") &&
      !url.searchParams.has("veaction") && !url.searchParams.has("diff");
  }

  function templateName(value) {
    if (typeof value !== "string") return "";
    let name = value.trim();
    if (/^(?:https?:|\/wiki\/|\/w\/index\.php)/i.test(name)) {
      try { name = titleFromUrl(new URL(name, ORIGIN)); } catch { return ""; }
    }
    name = decode(name).replace(/^\.\//, "").replace(/^Template\s*:\s*/i, "");
    return spaces(name).toLowerCase();
  }

  function validDescriptor(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.v !== 1 || typeof value.kind !== "string" ||
        !Number.isSafeInteger(value.rev) || value.rev < 1 || !Object.hasOwn(kinds, value.kind)) return false;
    for (const field of ["page", "kind", "editor", "template", "article", "section"]) {
      if (typeof value[field] !== "string" || value[field].length > 255 || /[\u0000-\u001f\u007f]/.test(value[field])) return false;
    }
    for (const field of ["page", "editor", "template", "article"]) if (/[|#<>\[\]{}]/.test(value[field])) return false;
    const family = aliases[templateName(value.template)];
    return Boolean(value.page.trim() && value.template.trim() && family && kinds[value.kind].includes(family));
  }

  function buildUrl(item) {
    const url = safeUrl(item?.sourceUrl);
    if (!url) return "";
    const original = url.href;
    const descriptor = {
      v: 1, page: item?.sourceTitle, rev: item?.sourceRevision, kind: item?.kind,
      editor: item?.contributor || "", template: item?.sourceTemplate || item?.template || "",
      article: item?.articles?.[0] || "", section: url.hash.slice(1) || item?.sectionTitle || ""
    };
    if (!validDescriptor(descriptor) || !readUrl(url) || !/^\d+$/.test(url.searchParams.get("oldid") || "") ||
        Number(url.searchParams.get("oldid")) !== descriptor.rev || pageName(titleFromUrl(url)) !== pageName(descriptor.page)) return original;
    const payload = JSON.stringify(descriptor);
    const encoded = encodeURIComponent(payload);
    if (payload.length > MAX_PAYLOAD || encoded.length > MAX_PAYLOAD * 3) return original;
    url.hash = MARKER + encoded;
    return url.href;
  }

  function currentDescriptor() {
    if (typeof location === "undefined" || typeof document === "undefined") return null;
    const url = safeUrl(location.href);
    if (!url || !readUrl(url) || !url.hash.startsWith(MARKER) || url.hash.length > MAX_PAYLOAD * 3 + MARKER.length) return null;
    let descriptor;
    try {
      const payload = decodeURIComponent(url.hash.slice(MARKER.length));
      if (payload.length > MAX_PAYLOAD) return null;
      descriptor = JSON.parse(payload);
    } catch { return null; }
    if (!validDescriptor(descriptor) || !/^\d+$/.test(url.searchParams.get("oldid") || "") ||
        Number(url.searchParams.get("oldid")) !== descriptor.rev || pageName(titleFromUrl(url)) !== pageName(descriptor.page)) return null;
    // The URL pins the source revision. Check rendered identity too when the
    // skin exposes it; abbreviated test fixtures and older skins may omit it.
    const heading = document.getElementById("firstHeading");
    if (heading && pageName(heading.textContent || "") !== pageName(descriptor.page)) return null;
    const revision = document.querySelector('meta[property="mw:revisionId"],.mw-revision [data-mw-revid]');
    const revisionId = revision?.getAttribute("content") || revision?.getAttribute("data-mw-revid");
    if (revisionId && Number(revisionId) !== descriptor.rev) return null;
    return descriptor;
  }

  function isSourceView() { return Boolean(currentDescriptor()); }

  function profileAccount(link) {
    try {
      const url = new URL(link.getAttribute("href") || "", document.baseURI || ORIGIN);
      if (url.origin !== ORIGIN) return "";
      const title = titleFromUrl(url);
      if (/^User\s*:/i.test(title)) return accountName(title.replace(/^User\s*:\s*/i, ""));
      const contributions = title.match(/^Special\s*:\s*Contributions\/([^#]+)$/i);
      return contributions ? accountName(contributions[1]) : "";
    } catch { return ""; }
  }

  function contentRoots(node, groups) {
    const about = node.getAttribute("about");
    const members = about ? groups.get(about) || [node] : [node];
    const usable = members.filter(member => !/^(?:STYLE|SCRIPT|LINK|META)$/.test(member.tagName));
    const boxes = [...new Set(usable.flatMap(member => [
      ...(member.matches(NOTICE) ? [member] : []), ...member.querySelectorAll(NOTICE)
    ]))];
    if (boxes.length) return boxes.filter(box => !boxes.some(other => other !== box && other.contains(box)));
    return usable.filter(member => spaces(member.textContent || "") && !usable.some(other => other !== member && other.contains(member)));
  }

  function editorRow(roots, editor) {
    const wanted = accountName(editor);
    for (const root of roots) for (const link of root.querySelectorAll("a[href]")) {
      if (profileAccount(link) !== wanted) continue;
      const row = link.closest("li");
      if (!row || !roots.some(member => member === row || member.contains(row))) continue;
      // A user mentioned later in someone else's disclosure is not its editor.
      const primary = [...row.querySelectorAll("a[href]")].find(anchor => profileAccount(anchor));
      if (primary && profileAccount(primary) === wanted) return row;
    }
    return null;
  }

  function paramAccount(value) {
    if (typeof value !== "string") return "";
    const clean = value.replace(/<!--[\s\S]*?-->/g, "").trim();
    const linked = clean.match(/^\[\[\s*User\s*:\s*([^|\]#]+)(?:\|[^\]]*)?\]\]$/i);
    return accountName(linked ? linked[1] : /[|#<>\[\]{}]/.test(clean) ? "" : clean);
  }

  function parameterEditors(template) {
    return Object.entries(template.params || {}).filter(([name]) => /^(?:User\d*|user|1)$/.test(name))
      .map(([, value]) => paramAccount(value?.wt)).filter(Boolean);
  }

  function articleMatches(template, roots, article) {
    if (!article) return false;
    const wanted = pageName(article);
    for (const name of ["article", "articles"]) {
      const value = template.params?.[name]?.wt;
      if (typeof value !== "string") continue;
      if (pageName(value) === wanted) return true;
      for (const match of value.matchAll(/\[\[\s*:?(?:\s*)([^|\]#]+)(?:\|[^\]]*)?\]\]/g)) if (pageName(match[1]) === wanted) return true;
    }
    return roots.some(root => [...root.querySelectorAll("a[href]")].some(link => {
      try {
        const url = new URL(link.getAttribute("href"), document.baseURI || ORIGIN);
        return url.origin === ORIGIN && pageName(titleFromUrl(url)) === wanted;
      } catch { return false; }
    }));
  }

  function sectionContains(roots, section) {
    if (!section) return true;
    const id = decode(section);
    const heading = document.getElementById(id) || document.getElementById(id.replaceAll(" ", "_"));
    if (!heading) return true; // A missing old fragment must not hide an exact template/editor match.
    const container = heading.closest("section");
    if (container) return roots.some(root => container.contains(root));
    // Older parser HTML has headings followed by siblings rather than sections.
    const start = heading.closest("h1,h2,h3,h4,h5,h6,.mw-heading") || heading;
    const level = Number((start.matches(".mw-heading") ? start.querySelector("h1,h2,h3,h4,h5,h6") : start)?.tagName?.slice(1));
    for (let node = start.nextElementSibling; node; node = node.nextElementSibling) {
      const next = node.matches("h1,h2,h3,h4,h5,h6") ? node : node.matches(".mw-heading") ? node.querySelector("h1,h2,h3,h4,h5,h6") : null;
      if (next && Number(next.tagName.slice(1)) <= level) break;
      if (roots.some(root => node === root || node.contains(root))) return true;
    }
    return false;
  }

  function findTargets(descriptor) {
    const groups = new Map();
    for (const node of document.querySelectorAll("[about]")) {
      const about = node.getAttribute("about");
      if (!groups.has(about)) groups.set(about, []);
      groups.get(about).push(node);
    }
    const wanted = templateName(descriptor.template);
    const family = aliases[wanted];
    const candidates = [];
    const metadataNodes = new Set();
    const metadataGroups = new Set();
    for (const node of document.querySelectorAll("[data-mw]")) {
      const raw = node.getAttribute("data-mw");
      if (!raw || raw.length > 100000) continue;
      let metadata;
      try { metadata = JSON.parse(raw); } catch { continue; }
      if (!Array.isArray(metadata?.parts)) continue;
      for (const part of metadata.parts) {
        const template = part?.template;
        if (!template || typeof template !== "object") continue;
        metadataNodes.add(node);
        if (node.hasAttribute("about")) metadataGroups.add(node.getAttribute("about"));
        const names = [templateName(template.target?.wt), templateName(template.target?.href)];
        const exact = names.includes(wanted);
        if (!exact && !names.some(name => aliases[name] === family)) continue;
        const roots = contentRoots(node, groups);
        if (roots.length && sectionContains(roots, descriptor.section)) candidates.push({ roots, template, exact });
      }
    }
    // Prefer the exact source alias when available, not an unrelated notice
    // that happens to be in the same template family.
    const preferred = candidates.some(candidate => candidate.exact) ? candidates.filter(candidate => candidate.exact) : candidates;
    const targets = [];
    for (const { roots, template } of preferred) {
      if (family === "paid") {
        if (!articleMatches(template, roots, descriptor.article)) continue;
        const named = paramAccount(template.params?.user?.wt);
        const owner = descriptor.page.match(/^User\s*:\s*([^/]+)/i)?.[1];
        if (descriptor.editor && accountName(named || owner || "") !== accountName(descriptor.editor)) continue;
        targets.push(...roots);
      } else if (descriptor.editor) {
        const named = parameterEditors(template);
        if (named.length && !named.includes(accountName(descriptor.editor))) continue;
        const row = editorRow(roots, descriptor.editor);
        if (row) targets.push(row);
      } else if (family !== "connected contributor (paid)" && family !== "connected contributor") targets.push(...roots);
    }
    if (targets.length) return [...new Set(targets)].slice(0, 20);

    // Legacy parser output lacks Parsoid metadata. Only use a notice box with
    // appropriate disclosure wording and an exact, primary editor profile row.
    if (!descriptor.editor || !["connected contributor (paid)", "connected contributor"].includes(family)) return [];
    for (const box of document.querySelectorAll(NOTICE)) {
      // A box whose transclusion is known to be a different template is not
      // legacy output, even if its prose happens to contain paid/COI wording.
      let hasMetadata = false;
      for (let ancestor = box; ancestor; ancestor = ancestor.parentElement) {
        if (metadataNodes.has(ancestor) || metadataGroups.has(ancestor.getAttribute("about"))) { hasMetadata = true; break; }
      }
      if (hasMetadata || [...metadataNodes].some(node => box.contains(node))) continue;
      const text = spaces(box.textContent || "");
      const wording = family === "connected contributor (paid)"
        ? /\b(?:has|have) been paid\b|\bpaid contribut(?:ion|or)s?\b|\bpaid edit(?:or|ing)s?\b/i.test(text)
        : /\bconflict(?:s)? of interest\b|\bconnected contribut(?:or|ion)s?\b|\bpersonal or professional connection\b/i.test(text);
      if (!wording || !sectionContains([box], descriptor.section)) continue;
      const row = editorRow([box], descriptor.editor);
      if (!row) continue;
      const rowText = spaces(row.textContent || "");
      const disclosure = family === "connected contributor (paid)"
        ? /\b(?:has|have) been paid\b|\b(?:is|was|are|were) paid\b|\bpaid by\b|\bpaid contribut(?:or|ion)s?\b|\bpaid editor\b/i.test(rowText)
        : /\bconflict(?:s)? of interest\b|\b(?:declared|disclosed|personal|professional) connection\b|\bconnected contribut(?:or|ion)s?\b|\b(?:is|are) the (?:subject|employer|client)\b/i.test(rowText);
      if (disclosure) return [row];
    }
    return [];
  }

  function stopObserving() {
    observerGeneration++;
    observer?.disconnect();
    observer = null;
    clearTimeout(observerTimer);
  }

  function clearHighlight() {
    for (const node of highlighted) node.removeAttribute("data-wikipaidia-source-highlight");
    highlighted.clear();
    document.getElementById("wikipaidia-source-status")?.remove();
  }

  function styleAndStatus(message, state = "missing") {
    if (!document.getElementById("wikipaidia-source-style")) {
      const style = document.createElement("style");
      style.id = "wikipaidia-source-style";
      style.textContent = '[data-wikipaidia-source-highlight]{background-color:#fff1b8!important;color:#202122!important;outline:3px solid #ac7100!important;outline-offset:4px;scroll-margin:90px}#wikipaidia-source-status{position:fixed;bottom:16px;right:16px;z-index:2147483646;max-width:350px;padding:10px 14px;border:1px solid #ac7100;border-radius:6px;background:#fff8df;color:#202122;font:14px/1.45 system-ui,sans-serif;box-shadow:0 2px 10px #0002}#wikipaidia-source-status[data-state="found"]{position:absolute;width:1px;height:1px;padding:0;margin:-1px;border:0;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap}';
      (document.head || document.documentElement).append(style);
    }
    let status = document.getElementById("wikipaidia-source-status");
    if (!status) {
      status = document.createElement("div");
      status.id = "wikipaidia-source-status";
      status.setAttribute("role", "status");
      (document.body || document.documentElement).append(status);
    }
    status.dataset.state = state;
    if (status.textContent !== message) status.textContent = message;
  }

  function reveal(target) {
    for (let node = target; node; node = node.parentElement) {
      if (node.tagName === "DETAILS") node.open = true;
      if (node.matches(".mw-collapsible,.collapsible")) {
        node.classList.remove("mw-collapsed", "collapsed");
        for (const content of node.querySelectorAll(".mw-collapsible-content")) {
          content.hidden = false;
          content.style.removeProperty("display");
        }
        for (const toggle of node.querySelectorAll(".mw-collapsible-toggle")) toggle.setAttribute("aria-expanded", "true");
      }
    }
  }

  function applyTargets(targets) {
    for (const target of targets) {
      reveal(target);
      target.setAttribute("data-wikipaidia-source-highlight", "true");
      highlighted.add(target);
    }
    styleAndStatus("Source evidence highlighted.", "found");
    targets[0].scrollIntoView?.({ behavior: "instant", block: "center", inline: "nearest" });
  }

  function locate() {
    if (typeof document === "undefined") return false;
    stopObserving();
    clearHighlight();
    const descriptor = currentDescriptor();
    if (!descriptor) {
      document.getElementById("wikipaidia-source-style")?.remove();
      return false;
    }
    const targets = findTargets(descriptor);
    if (targets.length) { applyTargets(targets); return true; }
    styleAndStatus("Matching source evidence could not be located on this page.");
    // document_idle normally has complete HTML. Permit a bounded retry for a
    // skin that inserts its rendered content slightly later, without fetching.
    if (typeof MutationObserver === "function") {
      let attempts = 0;
      const generation = observerGeneration;
      observer = new MutationObserver(() => {
        if (generation !== observerGeneration) return;
        if (++attempts > 20) { stopObserving(); return; }
        const found = findTargets(descriptor);
        if (found.length) { stopObserving(); applyTargets(found); }
      });
      observer.observe(document.getElementById("mw-content-text") || document.body || document.documentElement, { childList: true, subtree: true });
      observerTimer = setTimeout(stopObserving, 3000);
    }
    return false;
  }

  globalThis.WikipaidiaSource = Object.freeze({ buildUrl, locate, isSourceView });
  if (typeof location !== "undefined" && typeof document !== "undefined" && location.origin === ORIGIN) {
    globalThis.addEventListener("hashchange", locate);
    if (location.hash.startsWith(MARKER)) locate();
  }
})();
