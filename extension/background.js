import { scanArticle, validateTitle, SCAN_VERSION } from "./scanner.js";
import { createWikiClient } from "./wiki-api.js";

const webExtension = globalThis.browser ?? globalThis.chrome;
const TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 30;
const inFlight = new Map();

const isFresh = entry => entry && Date.now() - Date.parse(entry.checkedAt) < TTL_MS;

function reusableBasic(entry, title) {
  if (!isFresh(entry) || entry.version !== SCAN_VERSION || entry.deep !== false || entry.complete !== true ||
      !Array.isArray(entry.evidence) || !Array.isArray(entry.coverage) || !Array.isArray(entry.warnings)) return false;
  try { return validateTitle(entry.title) === title; }
  catch { return false; }
}

async function cachedScan(title, deep, refresh) {
  const key = `scan:${SCAN_VERSION}:${deep ? "deep" : "basic"}:${title}`;
  const basicKey = `scan:${SCAN_VERSION}:basic:${title}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const job = (async () => {
    let baseResult;
    if (!refresh) {
      try {
        const entries = await webExtension.storage.session?.get(deep ? [key, basicKey] : key);
        const entry = entries?.[key];
        // Only this session's stored scanner result may supply the deep-scan
        // baseline. Messages cannot supply cached evidence or source metadata.
        if (deep && reusableBasic(entries?.[basicKey], title)) baseResult = entries[basicKey];
        if (isFresh(entry) && (!deep || !baseResult || entry.baseCheckedAt === baseResult.checkedAt)) return { ...entry, cached: true };
      } catch { /* A disabled/unavailable cache must not prevent a public check. */ }
    }
    const result = await scanArticle(title, { deep, ...(baseResult ? { baseResult } : {}) });
    if (baseResult) result.baseCheckedAt = baseResult.checkedAt;
    // Session storage disappears when the browser quits. No browsing-history database.
    if (result.complete) {
      try {
        await webExtension.storage.session?.set({ [key]: result });
        const all = await webExtension.storage.session?.get(null) ?? {};
        const keys = Object.keys(all).filter(k => k.startsWith("scan:")).sort((a, b) => Date.parse(all[b].checkedAt) - Date.parse(all[a].checkedAt));
        if (keys.length > MAX_CACHE_ENTRIES) await webExtension.storage.session?.remove(keys.slice(MAX_CACHE_ENTRIES));
      } catch { /* Results remain usable when session storage is unavailable. */ }
    }
    return result;
  })();
  inFlight.set(key, job);
  try { return await job; } finally { inFlight.delete(key); }
}

webExtension.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["SCAN_ARTICLE", "GET_CONTRIBUTOR_EDITS", "GET_EDIT_DIFF", "GET_USER_STATUS"].includes(message?.type)) return false;
  try {
    if (sender.id !== webExtension.runtime.id || new URL(sender.url).origin !== "https://en.wikipedia.org") throw new Error("Open an English Wikipedia article to check disclosures.");
    const title = validateTitle(message.title);
    let job;
    if (message.type === "SCAN_ARTICLE") job = cachedScan(title, message.deep === true, message.refresh === true);
    else {
      const contributor = typeof message.contributor === "string" ? message.contributor.trim() : "";
      if (!contributor || contributor.length > 255 || /[|#<>\[\]{}\u0000-\u001f\u007f]/.test(contributor)) throw new Error("A valid contributor is required.");
      const client = createWikiClient();
      if (message.type === "GET_USER_STATUS") job = client.getUserBlockStatus(contributor);
      else if (message.type === "GET_CONTRIBUTOR_EDITS") job = client.getAllContributorEdits(title, contributor, { continuation: message.continuation ?? null });
      else {
        if (!Number.isSafeInteger(message.revid) || message.revid <= 0) throw new Error("A valid revision is required.");
        job = client.getArticleEditDiff(title, contributor, message.revid);
      }
    }
    job.then(
      result => sendResponse({ ok: true, result }),
      error => sendResponse({ ok: false, error: error.message || "The disclosure check failed. Please try again." })
    );
    return true;
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
    return false;
  }
});

webExtension.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try { await webExtension.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" }); }
  catch { /* Reading pages outside English Wikipedia has no interface to toggle. */ }
});
