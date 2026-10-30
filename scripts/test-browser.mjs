import assert from "node:assert/strict";
import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = process.env.WIKIPAIDIA_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const source = await readFile(path.join(root, "extension/content.js"), "utf8");
const diffModel = await readFile(path.join(root, "extension/diff-model.js"), "utf8");
const artifacts = path.join(root, "test-results");
const engineName = process.env.WIKIPAIDIA_BROWSER || "chromium";
if (!["chromium", "webkit"].includes(engineName)) throw new Error("WIKIPAIDIA_BROWSER must be chromium or webkit.");
await mkdir(artifacts, { recursive: true });

const paidEvidence = {
  id: "paid-fixture", kind: "paid-disclosure", heading: "Paid involvement listed",
  summary: "A paid contributor is listed in an article-specific disclosure.",
  excerpt: "FixtureEditor has been paid by Fixture Corporation.",
  sourceTitle: "Talk:Fixture Corporation",
  sourceUrl: "https://en.wikipedia.org/w/index.php?title=Talk%3AFixture_Corporation&oldid=12345",
  sourceRevision: 12345, sourceTimestamp: "2026-10-01T12:00:00Z",
  contributor: "FixtureEditor", employer: "Fixture Corporation", relationship: "page-notice"
};
const success = result => ({ ok: true, result });
function scanResult(evidence = [], additions = {}) {
  return {
    title: "Fixture Corporation", checkedAt: "2026-10-30T15:00:00Z", evidence,
    coverage: ["Current article and talk-page notices checked.", "No article revision history or archived discussions checked."],
    warnings: [], complete: true, ...additions
  };
}

async function makeContext(browser, { viewport = { width: 1280, height: 900 }, preference, color } = {}) {
  const context = await browser.newContext({ viewport });
  const preferences = { ...(preference ? { alertStyle: preference } : {}), ...(color ? { alertColor: color } : {}) };
  await context.exposeBinding("__readPreferences", () => ({ ...preferences }));
  await context.exposeBinding("__writePreferences", async (_source, values) => {
    const changes = {};
    for (const [key, value] of Object.entries(values)) {
      changes[key] = { oldValue: preferences[key], newValue: value };
      preferences[key] = value;
    }
    await Promise.all(context.pages().map(page => page.evaluate(changes => {
      window.__storageChangeListeners?.forEach(listener => listener(changes, "local"));
    }, changes).catch(() => {})));
  });
  return context;
}

async function makePage(browser, {
  responses = [success(scanResult())], url = "https://en.wikipedia.org/wiki/Fixture_Corporation",
  namespace = "ns-0", viewport, runtime = "browser", preference, color, context: suppliedContext,
  responseDelay = 10, messageResponses = {}, messageDelays = {}, heldMessages = {}
} = {}) {
  const context = suppliedContext || await makeContext(browser, { viewport, preference, color });
  const page = await context.newPage();
  await page.route("**/*", route => {
    const requestedUrl = new URL(route.request().url());
    if (requestedUrl.hostname !== "en.wikipedia.org") return route.abort();
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="canonical" href="https://en.wikipedia.org/wiki/Fixture_Corporation"><title>Fixture Corporation — Wikipedia</title><style>body{font-family:Georgia,serif;color:#202122;margin:0;background:#fff}header{border-bottom:1px solid #a2a9b1;padding:22px 70px;color:#54595d;font-family:Arial,sans-serif}main{max-width:960px;margin:55px auto;padding:0 30px}h1{font-size:32px;font-weight:normal;border-bottom:1px solid #a2a9b1;padding-bottom:10px}p{line-height:1.8}aside{float:right;width:240px;background:#f8f9fa;border:1px solid #a2a9b1;padding:16px;margin-left:30px}a{color:#36c}</style></head><body class="${namespace} action-view"><header>Wikipedia &nbsp; The Free Encyclopedia</header><main><h1 id="firstHeading">Fixture Corporation</h1><div id="mw-content-text"><p>From Wikipedia, the free encyclopedia</p><aside><strong>Fixture Corporation</strong><p>Fictional test article</p></aside><p id="article-text">This fictional article verifies the Wikipaidia extension.</p><p><a id="article-link" href="#history">Article link</a></p><button id="article-button" onclick="window.__articleClicked=true">Article action</button><h2 id="history">History</h2><p>All disclosure data is a controlled test fixture.</p></div></main></body></html>`
    });
  });
  await page.addInitScript(({ responses, runtime, responseDelay, messageResponses, messageDelays, heldMessages }) => {
    window.__requests = [];
    window.__responseCounts = {};
    window.__completedRequests = [];
    const pending = new Map();
    window.__releaseRequest = (type, index) => {
      const resolve = pending.get(`${type}:${index}`);
      if (!resolve) throw new Error(`No held request: ${type}:${index}`);
      pending.delete(`${type}:${index}`);
      resolve();
    };
    window.__togglePanel = null;
    window.__storageChangeListeners = [];
    window[runtime] = {
      runtime: {
        sendMessage: async message => {
          window.__requests.push(JSON.parse(JSON.stringify(message)));
          const defaults = {
            GET_USER_STATUS: [{ ok: true, result: { user: "FixtureEditor", blocked: false, exists: true } }],
            GET_CONTRIBUTOR_EDITS: [{ ok: true, result: { edits: [], hasMore: false, totalCount: 0 } }],
            GET_EDIT_DIFF: [{ ok: true, result: { changes: [], truncated: false } }]
          };
          const candidates = messageResponses[message.type] || defaults[message.type] || responses;
          const count = window.__responseCounts[message.type] || 0;
          window.__responseCounts[message.type] = count + 1;
          const index = Math.min(count, candidates.length - 1);
          if (heldMessages[message.type]?.includes(count)) await new Promise(resolve => pending.set(`${message.type}:${count}`, resolve));
          await new Promise(resolve => setTimeout(resolve, messageDelays[message.type] ?? responseDelay));
          window.__completedRequests.push(message.type);
          return candidates[index];
        },
        onMessage: { addListener: listener => { window.__togglePanel = listener; } }
      },
      storage: {
        local: {
          get: async keys => {
            const all = await window.__readPreferences();
            if (!keys) return all;
            if (typeof keys === "string") return { [keys]: all[keys] };
            if (Array.isArray(keys)) return Object.fromEntries(keys.map(key => [key, all[key]]));
            return { ...keys, ...all };
          },
          set: async values => window.__writePreferences(values)
        },
        onChanged: { addListener: listener => window.__storageChangeListeners.push(listener) }
      }
    };
  }, { responses, runtime, responseDelay, messageResponses, messageDelays, heldMessages });
  await page.goto(url);
  await page.addScriptTag({ content: diffModel });
  await page.addScriptTag({ content: source });
  return { page, context };
}

async function waitForStatus(page, text) {
  await page.locator(".status-title").filter({ hasText: text }).waitFor({ state: "attached" });
}
async function openToolbar(page) {
  await page.evaluate(() => window.__togglePanel({ type: "TOGGLE_PANEL" }));
  await page.getByRole("dialog").waitFor({ state: "visible" });
}
async function releaseRequest(page, type, index = 0) {
  await page.waitForFunction(({type, index}) => (window.__responseCounts[type] || 0) > index, {type, index});
  await page.evaluate(({type, index}) => window.__releaseRequest(type, index), {type, index});
}
async function assertQuiet(page) {
  assert.equal(await page.locator(".launcher").isVisible(), false);
  assert.equal(await page.locator(".page-tint").isVisible(), false);
}
let browser;
let failures = 0;
let checks = 0;
async function check(name, fn) {
  checks++;
  try { await fn(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack || error}`); }
}

try {
  if (engineName === "webkit") browser = await webkit.launch({ headless: true });
  else { await access(chromePath); browser = await chromium.launch({ executablePath: chromePath, headless: true }); }

  await check("paid evidence adds a concise top alert and preserves article text", async () => {
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence]))] });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      assert.equal(await page.locator(".launcher").isVisible(), true);
      assert.equal(await page.locator(".page-tint").isVisible(), false);
      const alert = await page.locator(".launcher").boundingBox();
      const heading = await page.locator("#firstHeading").boundingBox();
      assert.ok(alert.y >= heading.y && alert.y < heading.y + heading.height + 60);
      assert.equal(await page.locator("#article-text").innerText(), "This fictional article verifies the Wikipaidia extension.");
      assert.equal(await page.locator(".brand-caption,.lead,.footer").count(), 0);
      await page.screenshot({ path: path.join(artifacts, engineName === "webkit" ? "top-alert.png" : "top-alert-chromium.png") });
      await page.locator(".launcher").click();
      assert.match(await page.locator(".card").first().innerText(), /FixtureEditor/);
      assert.match(await page.locator(".facts").innerText(), /Fixture Corporation/);
      const link = page.getByRole("link", { name: "Source revision 12345", exact: true });
      assert.equal(await link.getAttribute("href"), paidEvidence.sourceUrl);
      assert.equal(await link.getAttribute("target"), "_blank");
      assert.match(await link.getAttribute("rel"), /noopener/);
      assert.equal(await page.getByText("Sources checked", { exact: true }).count(), 0);
      assert.equal(await page.locator(".coverage,.source-meta").count(), 0);
      assert.equal(await page.getByText("Cached", { exact: true }).count(), 0);
      await page.screenshot({ path: path.join(artifacts, engineName === "webkit" ? "compact-evidence.png" : "compact-evidence-chromium.png") });
    } finally { await context.close(); }
  });

  await check("cards use tinted type headers, linked labeled facts, and no Details section", async () => {
    const first = { ...paidEvidence, note: "Freelancer.", disclosureLinks: [{ label: "Disclosure", url: "https://en.wikipedia.org/wiki/User:FixtureEditor" }] };
    const other = { ...paidEvidence, id: "second-disclosure", contributor: "OtherEditor", note: "Another declaration." };
    const { page, context } = await makePage(browser, { responses: [success(scanResult([first, other]))] });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      const cards = page.locator(".card");
      assert.equal(await page.getByText("Details", { exact: true }).count(), 0);
      assert.equal(await page.locator(".card-details,blockquote").count(), 0);
      for (let index = 0; index < 2; index++) {
        const card = cards.nth(index);
        assert.match(await card.locator(".facts").innerText(), /Editor:/);
        assert.match(await card.locator(".facts").innerText(), /Employer:/);
        const revision = card.getByRole("link", { name: "Source revision 12345", exact: true });
        assert.match(await revision.getAttribute("title"), /Source page updated/);
        assert.equal(await revision.getAttribute("href"), paidEvidence.sourceUrl);
        const background = await card.locator(".card-label").evaluate(node => getComputedStyle(node).backgroundColor);
        assert.notEqual(background, "rgba(0, 0, 0, 0)");
        assert.notEqual(background, "rgb(255, 255, 255)");
      }
      const editor = cards.nth(0).getByRole("link", { name: "FixtureEditor", exact: true });
      assert.equal(decodeURIComponent(new URL(await editor.getAttribute("href")).pathname), "/wiki/User:FixtureEditor");
      const employer = cards.nth(0).getByRole("link", { name: "Fixture Corporation", exact: true });
      const employerUrl = new URL(await employer.getAttribute("href"));
      assert.equal(employerUrl.hostname, "en.wikipedia.org");
      assert.equal(employerUrl.searchParams.get("title"), "Special:Search");
      assert.equal(employerUrl.searchParams.get("search"), "Fixture Corporation");
      assert.equal(await employer.getAttribute("target"), "_blank");
      assert.doesNotMatch(await cards.nth(0).innerText(), /OtherEditor|Account edits;/);
      assert.doesNotMatch(await cards.nth(1).innerText(), /FixtureEditor|Account edits;/);
    } finally { await context.close(); }
  });

  await check("every notice type has a tinted header and known employer targets remain direct links", async () => {
    for (const kind of ["paid-disclosure", "paid-notice", "coi", "concern"]) {
      const evidence = { ...paidEvidence, kind, employerUrl: "https://en.wikipedia.org/wiki/Fixture_Corporation" };
      const { page, context } = await makePage(browser, { responses: [success(scanResult([evidence]))] });
      try {
        await waitForStatus(page, kind === "coi" ? "COI notice" : kind === "concern" ? "Payment concern" : "Paid involvement disclosed");
        await openToolbar(page);
        const card = page.locator(".card");
        const background = await card.locator(".card-label").evaluate(node => getComputedStyle(node).backgroundColor);
        assert.notEqual(background, "rgba(0, 0, 0, 0)");
        assert.notEqual(background, "rgb(255, 255, 255)");
        assert.equal(await card.locator(".employer-link").getAttribute("href"), evidence.employerUrl);
      } finally { await context.close(); }
    }
  });

  const articleEdit = { revid: 4002, parentid: 4001, timestamp: "2022-06-07T00:23:39Z", user: "FixtureEditor",
    comment: "Updated the career paragraph", diffUrl: "https://en.wikipedia.org/w/index.php?diff=4002&oldid=4001" };
  const editList = { edits: [articleEdit], hasMore: false, totalCount: 1 };
  const editDiff = { ...articleEdit, changes: [{ before: "The old career description.", after: "The revised career description." }], truncated: false };

  await check("colored headers independently collapse cards with pointer, Enter and Space while retaining loaded details", async () => {
    const before = "Earlier unchanged context. ".repeat(12)+"The founder stepped down in 2021 but remained chairman. "+"Later unchanged context. ".repeat(12);
    const after = before.replace("2021 but","2021, but");
    const evidence = [paidEvidence,...["paid-notice","coi","concern"].map(kind=>({...paidEvidence,id:`header-${kind}`,kind}))];
    const {page,context} = await makePage(browser, {
      responses:[success(scanResult(evidence))],
      messageResponses:{GET_CONTRIBUTOR_EDITS:[success(editList)],GET_EDIT_DIFF:[success({...articleEdit,changes:[{before,after}],truncated:false})],
        GET_USER_STATUS:[success({user:"FixtureEditor",exists:true,blocked:true,block:{id:42,reason:"Recorded test block",expiry:"infinite",partial:false}})]}
    });
    try {
      await waitForStatus(page,"Paid involvement disclosed");
      await openToolbar(page);
      const cards = page.locator(".card");
      assert.equal(await cards.count(),4);
      assert.equal(await cards.evaluateAll(nodes=>nodes.every(node=>node.tagName==="DETAILS"&&node.open&&node.firstElementChild.matches("summary.card-label"))),true);
      const paid = cards.first();
      await paid.locator(".change-unified").waitFor();
      await paid.locator(".block-badge").waitFor();
      await paid.getByRole("button",{name:"See More...",exact:true}).click();
      await paid.evaluate(node=>{window.__retainedParagraph=node.querySelector(".change-unified");window.__retainedBlock=node.querySelector(".editor-status");});
      const requestsBefore = await page.evaluate(()=>window.__requests);
      for (const {index,close,open} of [
        {index:0,close:"pointer",open:"Enter"},
        {index:1,close:"Space",open:"Space"},
        {index:2,close:"pointer",open:"Enter"},
        {index:3,close:"Enter",open:"Space"}
      ]) {
        const card = cards.nth(index);
        const header = card.locator(":scope > .card-label");
        if (close==="pointer") await header.click();
        else {await header.focus();await header.press(close);}
        assert.equal(await card.evaluate(node=>node.open),false);
        assert.equal(await card.locator(":scope > .card-body").isVisible(),false);
        for (let other=0;other<4;other++) if (other!==index) assert.equal(await cards.nth(other).locator(":scope > .card-body").isVisible(),true);
        if (index===0) await page.getByRole("dialog").screenshot({path:path.join(artifacts,"collapsed-evidence.png")});
        await header.focus();
        await header.press(open);
        assert.equal(await card.evaluate(node=>node.open),true);
        assert.equal(await card.locator(":scope > .card-body").isVisible(),true);
      }
      assert.equal(await paid.locator(".change-unified").evaluate(node=>node===window.__retainedParagraph),true);
      assert.equal(await paid.locator(".editor-status").evaluate(node=>node===window.__retainedBlock),true);
      assert.equal(await paid.locator(".paragraph-toggle").getAttribute("aria-expanded"),"true");
      assert.equal(await paid.locator(".change-text").textContent(),after);
      assert.equal(await paid.locator(".block-reason").textContent(),"Recorded test block");
      assert.deepEqual(await page.evaluate(()=>window.__requests),requestsBefore,"Collapsing and reopening evidence must reuse its loaded data.");
    } finally {await context.close();}
  });

  await check("history and diff placeholders reserve space, and late previews preserve an expanded paragraph", async () => {
    const before = "Earlier unchanged background. ".repeat(12) + "The founder stepped down in 2021 but remained chairman. " + "Later unchanged background. ".repeat(12);
    const after = before.replace("2021 but", "2021, but");
    const edits = Array.from({length: 3}, (_,index) => ({...articleEdit, revid: 4103-index, parentid:4102-index}));
    const {page,context} = await makePage(browser, {
      responses:[success(scanResult([paidEvidence]))],
      messageResponses:{GET_CONTRIBUTOR_EDITS:[success({edits,hasMore:false,totalCount:3})],GET_EDIT_DIFF:[success({...articleEdit,changes:[{before,after}],truncated:false})]},
      heldMessages:{GET_CONTRIBUTOR_EDITS:[0],GET_EDIT_DIFF:[0,1,2]}
    });
    try {
      await waitForStatus(page,"Paid involvement disclosed");
      await page.locator(".launcher").click();
      const placeholder = page.locator(".edits-placeholder");
      await placeholder.waitFor();
      assert.equal(await placeholder.getAttribute("aria-busy"),"true");
      assert.equal(await placeholder.locator(".skeleton-edit").count(),3);
      assert.ok((await placeholder.boundingBox()).height >= 180,"History loading should reserve room for three changes.");
      await page.emulateMedia({reducedMotion:"reduce"});
      assert.equal(await placeholder.locator(".skeleton-edit").first().evaluate(node=>getComputedStyle(node).animationName),"none");
      await page.getByRole("dialog").screenshot({path:path.join(artifacts,"loading-edits.png")});
      await releaseRequest(page,"GET_CONTRIBUTOR_EDITS");
      await page.locator(".diff-placeholder").nth(2).waitFor();
      assert.equal(await page.locator(".edits-placeholder").count(),0);
      assert.ok((await page.locator(".diff-placeholder").first().boundingBox()).height >= 70,"A pending preview should reserve space for its context snippet.");
      await releaseRequest(page,"GET_EDIT_DIFF",0);
      const first = page.locator(".edit-row").first();
      await first.locator(".change-unified").waitFor();
      await first.getByRole("button",{name:"See More...",exact:true}).click();
      await first.locator(".paragraph-toggle").focus();
      await first.locator(".change-unified").evaluate(node=>{window.__expandedParagraph=node;window.__paragraphToggle=node.querySelector(".paragraph-toggle");});
      const scrollBefore = await page.locator(".scroll").evaluate(node=>{node.scrollTop=130;return node.scrollTop;});
      await releaseRequest(page,"GET_EDIT_DIFF",1);
      await releaseRequest(page,"GET_EDIT_DIFF",2);
      await page.locator(".change-unified").nth(2).waitFor();
      assert.equal(await first.locator(".change-unified").evaluate(node=>node===window.__expandedParagraph),true);
      assert.equal(await first.locator(".paragraph-toggle").evaluate(node=>node===window.__paragraphToggle),true);
      assert.equal(await first.locator(".paragraph-toggle").getAttribute("aria-expanded"),"true");
      assert.equal(await first.locator(".paragraph-toggle").evaluate(node=>node.getRootNode().activeElement===node),true,"Loading another preview should preserve keyboard focus.");
      assert.equal(await first.locator(".change-text").textContent(),after);
      assert.ok(Math.abs(await page.locator(".scroll").evaluate(node=>node.scrollTop)-scrollBefore)<=1,"Later previews should preserve the reader’s scroll position.");
    } finally {await context.close();}
  });

  await check("the three latest changes load automatically and the exact remainder expands on demand", async () => {
    const edits = Array.from({ length: 7 }, (_, index) => ({ ...articleEdit,
      revid: 4010 - index, parentid: 4009 - index,
      timestamp: `2023-08-${String(20 - index).padStart(2, "0")}T12:00:00Z`,
      comment: `Edit ${index + 1}`, diffUrl: `https://en.wikipedia.org/w/index.php?diff=${4010-index}&oldid=${4009-index}`
    }));
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence]))], messageResponses: {
      GET_CONTRIBUTOR_EDITS: [success({ edits, hasMore: false, totalCount: edits.length })],
      GET_EDIT_DIFF: [success(editDiff)]
    } });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      assert.equal((await page.evaluate(() => window.__requests)).filter(r => r.type !== "SCAN_ARTICLE").length, 0);
      await page.locator(".launcher").click();
      await page.locator(".edit-row").nth(2).waitFor();
      await page.locator(".change-unified").nth(2).waitFor();
      assert.equal(await page.locator(".edit-row").count(), 3);
      assert.deepEqual(await page.locator(".edit-comment").allTextContents(), ["Edit 1", "Edit 2", "Edit 3"]);
      assert.equal(await page.getByRole("button", { name: "Show article edits", exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Show changes", exact: true }).count(), 0);
      assert.deepEqual((await page.evaluate(() => window.__requests)).filter(r => r.type === "GET_EDIT_DIFF").map(r => r.revid), edits.slice(0,3).map(e => e.revid));
      const lastRow = await page.locator(".edit-row").last().boundingBox();
      const moreButton = await page.getByRole("button", { name: "See 4 more edits", exact: true }).boundingBox();
      assert.ok(moreButton.y - (lastRow.y + lastRow.height) >= 10, "The remaining-edits button needs breathing room above it.");
      await page.getByRole("dialog").screenshot({ path: path.join(artifacts, "automatic-edits.png") });
      await page.getByRole("button", { name: "See 4 more edits", exact: true }).click();
      await page.locator(".edit-row").nth(6).waitFor();
      await page.locator(".change-unified").nth(6).waitFor();
      assert.equal(await page.locator(".edit-row").count(), 7);
      assert.equal((await page.evaluate(() => window.__requests)).filter(r => r.type === "GET_EDIT_DIFF").length, 7);
      await page.getByRole("button", { name: "See fewer edits", exact: true }).click();
      assert.equal(await page.locator(".edit-row").count(), 3);
      await page.getByRole("button", { name: "See 4 more edits", exact: true }).click();
      assert.equal(await page.locator(".edit-row").count(), 7);
      assert.equal((await page.evaluate(() => window.__requests)).filter(r => r.type === "GET_EDIT_DIFF").length, 7);
      await page.getByRole("dialog").screenshot({ path: path.join(artifacts, "automatic-edits-expanded.png") });
    } finally { await context.close(); }
  });

  await check("bounded history does not invent a remaining edit count", async () => {
    const edits = Array.from({ length: 3 }, (_, index) => ({ ...articleEdit, revid: 4002-index, parentid:4001-index }));
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence]))], messageResponses: {
      GET_CONTRIBUTOR_EDITS: [success({ edits, hasMore: true, totalCount: null, continuation: { rvcontinue: "older", continue: "||" } })],
      GET_EDIT_DIFF: [success(editDiff)]
    } });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      await page.locator(".edit-row").nth(2).waitFor();
      assert.equal(await page.getByRole("button", { name: /^See \d+ more edits$/ }).count(), 0);
      await page.getByRole("button", { name: "Load more edits", exact: true }).waitFor();
    } finally { await context.close(); }
  });

  await check("a history response arriving after refresh does not fetch changes for a removed disclosure", async () => {
    const {page,context}=await makePage(browser,{
      responses:[success(scanResult([paidEvidence])),success(scanResult())],
      messageResponses:{GET_CONTRIBUTOR_EDITS:[success(editList)],GET_EDIT_DIFF:[success(editDiff)]},
      messageDelays:{GET_CONTRIBUTOR_EDITS:350}
    });
    try {
      await waitForStatus(page,"Paid involvement disclosed");
      await page.locator(".launcher").click();
      await page.waitForFunction(()=>window.__requests.some(request=>request.type==="GET_CONTRIBUTOR_EDITS"));
      await page.getByRole("button",{name:"Refresh",exact:true}).click();
      await waitForStatus(page,"No disclosure found");
      assert.equal(await page.locator(".card").count(),0);
      await page.waitForFunction(()=>window.__completedRequests.includes("GET_CONTRIBUTOR_EDITS"));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal((await page.evaluate(()=>window.__requests)).filter(request=>request.type==="GET_EDIT_DIFF").length,0);
      await assertQuiet(page);
    } finally {await context.close();}
  });

  await check("a comma-only edit is contextual by default and expands into one full paragraph", async () => {
    const before = "The founder graduated with a degree in biology and later earned a law degree. He worked as an investment partner before founding a biotechnology company in 2014. He stepped down as chief executive in 2021 but remained its chairman until 2023. He later co-founded an investment firm and announced a presidential campaign. The rest of this paragraph is unchanged context, including these ordinary commas, brackets [[Example]], and punctuation.";
    const after = before.replace("2021 but", "2021, but");
    const start = after.indexOf("2021,") + 4;
    const commaDiff = { ...articleEdit, changes: [{ before, after, afterHighlights: [{ start, end: start + 1 }] }], truncated: false };
    const { page, context } = await makePage(browser, { viewport: { width: 1280, height: 1000 }, responses: [success(scanResult([paidEvidence]))], messageResponses: {
      GET_CONTRIBUTOR_EDITS: [success({ ...editList, edits: [{ ...articleEdit, comment: "Comma" }] })], GET_EDIT_DIFF: [success(commaDiff)]
    } });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      const unified = page.locator(".change-text");
      const mark = unified.locator(".diff-add");
      await mark.waitFor();
      assert.deepEqual(await mark.allTextContents(), [","]);
      assert.equal(await unified.locator(".diff-remove").count(), 0);
      assert.equal(await page.locator(".change-before,.change-after,.change-label").count(), 0);
      const compact = await unified.textContent();
      assert.ok(compact.length < after.length / 2, compact);
      assert.match(compact, /2021, but/);
      assert.match(compact, /…/);
      assert.doesNotMatch(compact, /graduated|\[\[Example\]\]/);
      const appearance = await mark.evaluate(node => {
        const style = getComputedStyle(node);
        const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const luminance = color => rgb(color).map(value => { const s = value / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const foreground = luminance(style.color), background = luminance(style.backgroundColor);
        return { foreground, background, contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05), editable: node.isContentEditable };
      });
      assert.ok(appearance.foreground > 0.9 && appearance.background < 0.2, JSON.stringify(appearance));
      assert.ok(appearance.contrast >= 4.5, JSON.stringify(appearance));
      assert.equal(appearance.editable, false);
      const expand = page.getByRole("button", { name: "See More...", exact: true });
      assert.equal(await page.locator(".change-unified .paragraph-toggle").count(), 1);
      await expand.click();
      assert.equal(await unified.textContent(), after);
      assert.equal(await unified.locator(".diff-add").textContent(), ",");
      await page.getByRole("button", { name: "See Less...", exact: true }).click();
      assert.equal(await unified.textContent(), compact);
      await page.getByRole("dialog").screenshot({ path: path.join(artifacts, engineName === "webkit" ? "contextual-diff.png" : "contextual-diff-chromium.png") });
    } finally { await context.close(); }
  });

  await check("one combined diff preserves Unicode and whitespace while color-coding replacements", async () => {
    const before = "😀 The old name used two  spaces and a trailing period.";
    const after = "😀 The new name used two spaces and a trailing comma,";
    const changes = [{ before, after,
      beforeHighlights: [{ start: before.indexOf("old"), end: before.indexOf("old") + 3 }, { start: before.indexOf("  "), end: before.indexOf("  ") + 1 }, { start: before.indexOf("period"), end: before.length }],
      afterHighlights: [{ start: after.indexOf("new"), end: after.indexOf("new") + 3 }, { start: after.indexOf("comma"), end: after.length }]
    }];
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence]))], messageResponses: {
      GET_CONTRIBUTOR_EDITS: [success(editList)], GET_EDIT_DIFF: [success({ ...articleEdit, changes, truncated: false })]
    } });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      const unified = page.locator(".change-text");
      await unified.locator(".diff-add").first().waitFor();
      const expand = page.getByRole("button", { name: "See More...", exact: true });
      if (await expand.count()) await expand.click();
      assert.deepEqual(await unified.locator(".diff-remove").allTextContents(), ["old", " ", "period."]);
      assert.deepEqual(await unified.locator(".diff-add").allTextContents(), ["new", "comma,"]);
      const projections = await unified.evaluate(node => {
        const original = node.cloneNode(true), updated = node.cloneNode(true);
        original.querySelectorAll(".diff-add").forEach(n => n.remove());
        updated.querySelectorAll(".diff-remove").forEach(n => n.remove());
        return [original.textContent, updated.textContent];
      });
      assert.deepEqual(projections, [before, after]);
      assert.equal((await unified.textContent()).split("😀").length - 1, 1);
      assert.equal(await unified.locator(".diff-remove").nth(1).evaluate(node => getComputedStyle(node).whiteSpace), "pre-wrap");
    } finally { await context.close(); }
  });

  await check("article edits show date and diff together without account-edit boilerplate", async () => {
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence]))], messageResponses: {
      GET_CONTRIBUTOR_EDITS: [success(editList)], GET_EDIT_DIFF: [success(editDiff)]
    } });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      assert.equal((await page.evaluate(() => window.__requests)).filter(r => r.type !== "SCAN_ARTICLE").length, 0);
      await page.locator(".launcher").click();
      await page.locator(".edit-row").waitFor();
      assert.equal(await page.locator(".edit-date").getAttribute("title"), articleEdit.timestamp);
      assert.doesNotMatch(await page.locator(".card").innerText(), /Account edits;/);
      const metadata = page.locator(".edit-meta");
      assert.equal(await metadata.locator(".edit-date").count(), 1);
      assert.equal(await metadata.getByRole("link", { name: "Diff 4002", exact: true }).count(), 1);
      const dateBox = await metadata.locator(".edit-date").boundingBox();
      const diffBox = await metadata.getByRole("link", { name: "Diff 4002", exact: true }).boundingBox();
      assert.ok(Math.abs(dateBox.y - diffBox.y) < 8);
      assert.equal(await page.getByRole("link", { name: "Diff 4002", exact: true }).getAttribute("href"), articleEdit.diffUrl);
      await page.locator(".change-unified").waitFor();
      assert.match(await page.locator(".change-text").textContent(), /career description/);
      assert.equal(await page.locator(".change-unified").count(), 1);
      const requests = await page.evaluate(() => window.__requests);
      assert.deepEqual(requests.slice(1).filter(request => request.type !== "GET_USER_STATUS").map(request => [request.type, request.title, request.contributor, request.revid ?? null]), [
        ["GET_CONTRIBUTOR_EDITS", "Fixture Corporation", "FixtureEditor", null],
        ["GET_EDIT_DIFF", "Fixture Corporation", "FixtureEditor", 4002]
      ]);
      await page.screenshot({ path: path.join(artifacts, engineName === "webkit" ? "article-changes.png" : "article-changes-chromium.png") });
    } finally { await context.close(); }
  });

  await check("a disclosure without direct article edits does not invent a change", async () => {
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence]))], messageResponses: {
      GET_CONTRIBUTOR_EDITS: [success({ edits: [], hasMore: false })]
    } });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      await page.getByText(/No direct article edits found/).waitFor();
      assert.equal(await page.locator(".edit-row,.change").count(), 0);
      assert.equal(await page.getByRole("button", { name: "Show changes", exact: true }).count(), 0);
      assert.equal((await page.evaluate(() => window.__requests)).filter(r => r.type === "GET_EDIT_DIFF").length, 0);
    } finally { await context.close(); }
  });

  await check("an editor’s current block appears below their profile with a linked reason and labeled dates", async () => {
    const contributor = "FinalFrontier.003";
    const reason = "Abusing multiple accounts";
    const reasonUrl = "https://en.wikipedia.org/wiki/Wikipedia:Sockpuppet_investigations/Changingguardsatbuckinghampalace";
    const logUrl = "https://en.wikipedia.org/w/index.php?title=Special%3ALog&type=block&page=User%3AFinalFrontier.003";
    const {page,context} = await makePage(browser, {
      responses:[success(scanResult([{...paidEvidence,contributor}]))],
      messageResponses:{GET_USER_STATUS:[success({user:contributor,exists:true,blocked:true,block:{id:9510224,by:"Bbb23",reason,reasonUrl,expiry:"infinite",timestamp:"2020-01-20T17:42:10Z",partial:false,logUrl}})]}
    });
    try {
      await waitForStatus(page,"Paid involvement disclosed");
      assert.equal((await page.evaluate(()=>window.__requests)).filter(request=>request.type==="GET_USER_STATUS").length,0);
      await page.locator(".launcher").click();
      await page.locator(".block-badge").waitFor();
      assert.equal(await page.locator(".block-badge").innerText(),"User Blocked");
      assert.equal(await page.locator(".block-reason").innerText(),reason);
      const profileValue = page.locator(".facts dd").filter({has:page.locator(".editor-link")});
      assert.equal(await profileValue.locator(":scope > .editor-status").count(),1);
      assert.equal(await page.locator(".editor-link").evaluate(node=>node.nextElementSibling?.classList.contains("editor-status")),true);
      assert.equal(await profileValue.evaluate(node=>node.nextElementSibling?.textContent),"Employer:");
      const profileBox = await page.locator(".editor-link").boundingBox();
      const statusBox = await page.locator(".editor-status").boundingBox();
      const employerBox = await page.locator(".employer-link").boundingBox();
      assert.ok(statusBox.y >= profileBox.y+profileBox.height,"The block status should sit below the editor profile link.");
      assert.ok(employerBox.y >= statusBox.y+statusBox.height,"The employer row should follow the editor’s block status.");
      assert.equal(await page.locator(".block-meta").getByText("On: Jan 20, 2020",{exact:true}).count(),1);
      assert.equal(await page.locator(".block-meta").getByText("Duration: Indefinite",{exact:true}).count(),1);
      const reasonLink = page.locator(".block-reason a");
      assert.equal(await reasonLink.count(),1);
      assert.equal(await reasonLink.getAttribute("href"),reasonUrl);
      assert.equal(await reasonLink.getAttribute("target"),"_blank");
      assert.match(await reasonLink.getAttribute("rel"),/noopener/);
      assert.equal(await page.getByRole("link",{name:"Block log",exact:true}).count(),0);
      assert.doesNotMatch(await page.locator(".editor-status").innerText(),/Please see:|Changingguardsatbuckinghampalace|Since|Until/);
      assert.equal((await page.evaluate(()=>window.__requests)).find(request=>request.type==="GET_USER_STATUS").contributor,contributor);
      await page.getByRole("dialog").screenshot({path:path.join(artifacts,"blocked-editor.png")});
    } finally {await context.close();}
  });

  await check("partial blocks label their scope and expiry while malicious reasons and unsafe links stay inert", async () => {
    const reason = '<img src=x onerror="window.__reasonExecuted=true"> [[Policy]]';
    const expiry = "2026-12-01T12:00:00Z";
    const {page,context} = await makePage(browser, {
      responses:[success(scanResult([paidEvidence]))],
      messageResponses:{GET_USER_STATUS:[success({user:"FixtureEditor",exists:true,blocked:true,block:{id:42,reason,reasonUrl:"javascript:alert(1)",expiry,partial:true,logUrl:"javascript:alert(1)"}})]}
    });
    try {
      await waitForStatus(page,"Paid involvement disclosed");
      await page.locator(".launcher").click();
      await page.locator(".block-badge").waitFor();
      assert.equal(await page.locator(".block-badge").innerText(),"User Blocked");
      assert.equal(await page.locator(".block-meta").getByText("Scope: Partial",{exact:true}).count(),1);
      const expectedExpiry = await page.evaluate(value => new Date(value).toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short"
      }), expiry);
      assert.equal(await page.locator(".block-duration").textContent(), `Duration: ${expectedExpiry}`);
      assert.equal(await page.locator(".block-reason").textContent(),reason);
      assert.equal(await page.locator(".editor-status img,.editor-status script").count(),0);
      assert.equal(await page.evaluate(()=>Boolean(window.__reasonExecuted)),false);
      assert.equal(await page.locator('.editor-status a[href^="javascript:"]').count(),0);
      assert.equal(await page.locator(".block-reason a").count(),0);
      assert.equal(await page.getByRole("link",{name:"Block log",exact:true}).count(),0);
    } finally {await context.close();}
  });

  await check("an old banned disclosure does not imply a current block, and lookup failure stays distinct", async () => {
    for (const unavailable of [false,true]) {
      const {page,context} = await makePage(browser, {
        responses:[success(scanResult([{...paidEvidence,note:"Historical notice: banned=yes",banned:true}]))],
        messageResponses:{GET_USER_STATUS:[unavailable?{ok:false,error:"Block status unavailable (fixture)."}:success({user:"FixtureEditor",blocked:false,exists:true})]}
      });
      try {
        await waitForStatus(page,"Paid involvement disclosed");
        await page.locator(".launcher").click();
        await page.waitForFunction(()=>window.__completedRequests.includes("GET_USER_STATUS"));
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
        assert.equal(await page.locator(".block-badge").count(),0);
        const text = await page.locator(".card").innerText();
        if (unavailable) assert.match(text,/Block status unavailable/i);
        else assert.doesNotMatch(text,/Block status unavailable|User Blocked|Scope: Partial/i);
      } finally {await context.close();}
    }
  });

  await check("Refresh rechecks current block status, removing old blocks and retrying unavailable lookups", async () => {
    const blocked = success({user:"FixtureEditor",exists:true,blocked:true,block:{id:42,reason:"Recorded test block",expiry:"infinite",partial:false,
      logUrl:"https://en.wikipedia.org/w/index.php?title=Special%3ALog&type=block&page=User%3AFixtureEditor"}});
    const unblocked = success({user:"FixtureEditor",exists:true,blocked:false});
    for (const retryFailure of [false,true]) {
      const {page,context} = await makePage(browser, {
        responses:[success(scanResult([paidEvidence]))],
        messageResponses:{GET_USER_STATUS:retryFailure?[{ok:false,error:"Unavailable"},blocked]:[blocked,unblocked]}
      });
      try {
        await waitForStatus(page,"Paid involvement disclosed");
        await page.locator(".launcher").click();
        if (retryFailure) await page.getByText("Block status unavailable.",{exact:true}).waitFor();
        else await page.locator(".block-badge").waitFor();
        await page.getByRole("button",{name:"Refresh",exact:true}).click();
        await page.getByRole("button",{name:"Refresh",exact:true}).waitFor();
        await page.waitForFunction(()=>window.__completedRequests.filter(type=>type==="GET_USER_STATUS").length===2);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
        assert.equal((await page.evaluate(()=>window.__requests)).filter(request=>request.type==="GET_USER_STATUS").length,2);
        assert.equal(await page.getByText("Block status unavailable.",{exact:true}).count(),0);
        assert.equal(await page.locator(".block-badge").count(),retryFailure?1:0);
      } finally {await context.close();}
    }
  });

  await check("a superseded block lookup cannot restore an old badge after Refresh", async () => {
    const {page,context} = await makePage(browser, {
      responses:[success(scanResult([paidEvidence]))],
      messageResponses:{GET_USER_STATUS:[success({user:"FixtureEditor",exists:true,blocked:true,block:{id:42,reason:"Superseded block",expiry:"infinite",partial:false}}),success({user:"FixtureEditor",exists:true,blocked:false})]},
      heldMessages:{GET_USER_STATUS:[0]}
    });
    try {
      await waitForStatus(page,"Paid involvement disclosed");
      await page.locator(".launcher").click();
      await page.waitForFunction(()=>window.__responseCounts.GET_USER_STATUS===1);
      await page.getByRole("button",{name:"Refresh",exact:true}).click();
      await page.getByRole("button",{name:"Refresh",exact:true}).waitFor();
      await page.waitForFunction(()=>window.__responseCounts.GET_USER_STATUS===2&&window.__completedRequests.includes("GET_USER_STATUS"));
      await releaseRequest(page,"GET_USER_STATUS",0);
      await page.waitForFunction(()=>window.__completedRequests.filter(type=>type==="GET_USER_STATUS").length===2);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      assert.equal(await page.locator(".block-badge").count(),0);
      assert.doesNotMatch(await page.locator(".card").innerText(),/Superseded block/);
    } finally {await context.close();}
  });

  await check("article edit and change failures can retry without losing source evidence", async () => {
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence]))], messageResponses: {
      GET_CONTRIBUTOR_EDITS: [{ ok: false, error: "Article edits unavailable (fixture)." }, success(editList)],
      GET_EDIT_DIFF: [{ ok: false, error: "Diff unavailable (fixture)." }, success(editDiff)]
    } });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      await page.getByRole("button", { name: "Retry article edits", exact: true }).click();
      await page.getByRole("button", { name: "Retry changes", exact: true }).click();
      await page.locator(".change-unified").waitFor();
      assert.equal(await page.getByRole("link", { name: "Source revision 12345", exact: true }).count(), 1);
      assert.equal((await page.evaluate(() => window.__requests)).filter(r => r.type === "GET_EDIT_DIFF").length, 2);
    } finally { await context.close(); }
  });

  await check("diff previews and disclosure links cannot execute markup or open unsafe destinations", async () => {
    const malicious = '<img src=x onerror="window.__diffXss=true"><script>window.__diffXss=true</script>';
    const evidence = { ...paidEvidence, disclosureLinks: [
      { label: "Unsafe", url: "javascript:alert(1)" }, { label: "Offsite", url: "https://example.com/private" }
    ] };
    const { page, context } = await makePage(browser, { responses: [success(scanResult([evidence]))], messageResponses: {
      GET_CONTRIBUTOR_EDITS: [success({ edits: [{ ...articleEdit, diffUrl: "javascript:alert(1)" }], hasMore: false })],
      GET_EDIT_DIFF: [success({ ...editDiff, changes: [{ before: "", after: malicious,
        afterHighlights: [{ start: 0, end: malicious.length }] }], truncated: true })]
    } });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      assert.equal(await page.getByRole("link", { name: "Unsafe", exact: true }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "Offsite", exact: true }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "Diff 4002", exact: true }).count(), 0);
      await page.locator(".change-unified").waitFor();
      assert.match(await page.locator(".change-text").textContent(), /<img src=x onerror=/);
      assert.equal(await page.locator(".edit-changes img,.edit-changes script").count(), 0);
      assert.equal(await page.evaluate(() => window.__diffXss), undefined);
      assert.match(await page.locator(".edit-changes").innerText(), /Preview shortened/);
    } finally { await context.close(); }
  });

  await check("mismatched exact ranges defer to the linked diff rather than inventing a combined change", async () => {
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence]))], messageResponses: {
      GET_CONTRIBUTOR_EDITS: [success(editList)],
      GET_EDIT_DIFF: [success({ ...editDiff, changes: [{ before: "abc", after: "adc", beforeHighlights: [{ start: 0, end: 1 }], afterHighlights: [{ start: 0, end: 1 }] }], truncated: false })]
    } });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      await page.getByText("Inline preview unavailable. Open the diff link.", { exact: true }).waitFor();
      assert.equal(await page.locator(".change-unified,.diff-add,.diff-remove").count(), 0);
      assert.equal(await page.getByRole("link", { name: "Diff 4002", exact: true }).getAttribute("href"), articleEdit.diffUrl);
    } finally { await context.close(); }
  });

  await check("page tint covers the viewport without blocking article interaction", async () => {
    const { page, context } = await makePage(browser, { preference: "tint", responses: [success(scanResult([paidEvidence]))] });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".page-tint").waitFor({ state: "visible" });
      const rect = await page.locator(".page-tint").boundingBox();
      assert.deepEqual(rect, { x: 0, y: 0, width: 1280, height: 900 });
      assert.equal(await page.locator(".page-tint").evaluate(node => getComputedStyle(node).pointerEvents), "none");
      await page.locator("#article-button").click();
      assert.equal(await page.evaluate(() => window.__articleClicked), true);
      assert.equal(await page.locator(".launcher").isVisible(), true);
      assert.match(await page.locator(".launcher").getAttribute("aria-label"), /Paid involvement disclosed/);
      await page.screenshot({ path: path.join(artifacts, engineName === "webkit" ? "page-tint.png" : "page-tint-chromium.png") });
    } finally { await context.close(); }
  });

  await check("alert preference persists on fresh pages and updates already open pages", async () => {
    const context = await makeContext(browser);
    try {
      const first = (await makePage(browser, { context, responses: [success(scanResult([paidEvidence]))] })).page;
      const second = (await makePage(browser, { context, responses: [success(scanResult([paidEvidence]))] })).page;
      await waitForStatus(first, "Paid involvement disclosed");
      await waitForStatus(second, "Paid involvement disclosed");
      await first.locator(".launcher").click();
      await first.getByRole("combobox", { name: "Alert style", exact: true }).selectOption("tint");
      await first.locator(".page-tint").waitFor({ state: "visible" });
      await second.locator(".page-tint").waitFor({ state: "visible" });
      const fresh = (await makePage(browser, { context, responses: [success(scanResult([paidEvidence]))] })).page;
      await waitForStatus(fresh, "Paid involvement disclosed");
      await fresh.locator(".page-tint").waitFor({ state: "visible" });
      await first.getByRole("combobox", { name: "Alert style", exact: true }).selectOption("top");
      await second.locator(".page-tint").waitFor({ state: "hidden" });
      await fresh.locator(".page-tint").waitFor({ state: "hidden" });
    } finally { await context.close(); }
  });

  await check("header style and color pickers update both alerts and persist across articles", async () => {
    const context = await makeContext(browser);
    try {
      const first = (await makePage(browser, { context, responses: [success(scanResult([paidEvidence]))] })).page;
      const second = (await makePage(browser, { context, responses: [success(scanResult([paidEvidence]))] })).page;
      await waitForStatus(first, "Paid involvement disclosed");
      await waitForStatus(second, "Paid involvement disclosed");
      await first.locator(".launcher").click();
      const picker = first.getByRole("combobox", { name: "Alert style", exact: true });
      const color = first.getByLabel("Alert color", { exact: true });
      assert.deepEqual(await picker.locator("option").allTextContents(), ["Banner", "Page Tint"]);
      assert.equal(await first.locator(".topbar .alert-style-picker").count(), 1);
      assert.equal(await first.locator(".topbar .alert-color-picker").count(), 1);
      assert.equal(await first.locator(".preferences").count(), 0);
      const boxes = await Promise.all([picker.boundingBox(), color.boundingBox(), first.getByRole("button", { name: "Close", exact: true }).boundingBox()]);
      assert.ok(boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x);
      assert.ok(Math.abs(boxes[0].y-boxes[2].y)<12);
      const initial = await first.locator(".launcher").evaluate(node => getComputedStyle(node).backgroundColor);
      await color.evaluate(input => { input.value = "#3366cc"; input.dispatchEvent(new Event("input",{bubbles:true})); input.dispatchEvent(new Event("change",{bubbles:true})); });
      await first.waitForFunction(() => window.__readPreferences().then(p => p.alertColor === "#3366cc"));
      await first.waitForFunction(initial => {
        const host = document.querySelector("#wikipaidia-article-alert");
        return getComputedStyle(host.shadowRoot.querySelector(".launcher")).backgroundColor !== initial;
      }, initial);
      const banner = await first.locator("#wikipaidia-article-alert").evaluate(node => getComputedStyle(node).getPropertyValue("--alert-background"));
      const otherBanner = await second.locator("#wikipaidia-article-alert").evaluate(node => getComputedStyle(node).getPropertyValue("--alert-background"));
      assert.equal(otherBanner, banner);
      await picker.selectOption("tint");
      await second.locator(".page-tint").waitFor({state:"visible"});
      const tint = await first.locator(".page-tint").evaluate(node => getComputedStyle(node).backgroundColor);
      assert.match(tint, /51, 102, 204/);
      const fresh = (await makePage(browser, { context, responses:[success(scanResult([paidEvidence]))] })).page;
      await waitForStatus(fresh, "Paid involvement disclosed");
      await fresh.locator(".page-tint").waitFor({state:"visible"});
      await fresh.locator(".launcher").click();
      assert.equal(await fresh.getByLabel("Alert color", {exact:true}).inputValue(), "#3366cc");
      assert.equal(await fresh.getByRole("combobox", {name:"Alert style",exact:true}).inputValue(), "tint");
      assert.equal(await fresh.locator(".page-tint").evaluate(node=>getComputedStyle(node).backgroundColor),tint);
      await first.getByRole("dialog").screenshot({path:path.join(artifacts,"header-pickers.png")});
    } finally { await context.close(); }
  });

  await check("only disclosed paid evidence triggers alerts or tint", async () => {
    for (const [evidence, status] of [
      [[], "No disclosure found"],
      [[{ ...paidEvidence, kind: "coi" }], "COI notice"],
      [[{ ...paidEvidence, kind: "concern" }], "Payment concern"]
    ]) {
      const { page, context } = await makePage(browser, { preference: "tint", responses: [success(scanResult(evidence))] });
      try { await waitForStatus(page, status); await assertQuiet(page); await openToolbar(page); assert.equal(await page.locator(".card").count(), evidence.length); }
      finally { await context.close(); }
    }
  });

  await check("loading, failed, and incomplete empty checks leave the article unmarked", async () => {
    for (const response of [{ ok: false, error: "Wikipedia could not be reached." }, success(scanResult([], { complete: false, warnings: ["Talk page unavailable."] }))]) {
      const { page, context } = await makePage(browser, { preference: "tint", responseDelay: 100, responses: [response] });
      try {
        await assertQuiet(page);
        await waitForStatus(page, response.ok ? "Check incomplete" : "Check unavailable");
        await assertQuiet(page);
        await openToolbar(page);
        if (!response.ok) assert.match(await page.locator(".status-detail").innerText(), /could not be reached/);
      } finally { await context.close(); }
    }
  });

  await check("refresh removes old page effects when paid evidence disappears", async () => {
    const { page, context } = await makePage(browser, { preference: "tint", responses: [success(scanResult([paidEvidence])), success(scanResult())] });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      await waitForStatus(page, "No disclosure found");
      await assertQuiet(page);
    } finally { await context.close(); }
  });

  await check("deeper scan and refresh preserve the correct request scope", async () => {
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence]))] });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      await page.getByRole("button", { name: "Check more sources", exact: true }).click();
      await waitForStatus(page, "Paid involvement disclosed");
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      await waitForStatus(page, "Paid involvement disclosed");
      assert.deepEqual((await page.evaluate(() => window.__requests)).filter(r => r.type === "SCAN_ARTICLE").map(r => [r.type, r.deep, r.refresh]), [["SCAN_ARTICLE", false, false], ["SCAN_ARTICLE", true, false], ["SCAN_ARTICLE", true, true]]);
    } finally { await context.close(); }
  });

  await check("checking more sources appends findings without replacing existing cards or reader state", async () => {
    const before = "Unchanged context before the edited sentence. ".repeat(12)+"The founder stepped down in 2021 but remained chairman. "+"Unchanged context after the edited sentence. ".repeat(12);
    const after = before.replace("2021 but","2021, but");
    const extra = {...paidEvidence,id:"user-disclosure",sourceTitle:"User:FixtureEditor",sourceRevision:54321,
      sourceUrl:"https://en.wikipedia.org/w/index.php?title=User%3AFixtureEditor&oldid=54321",relationship:"user-page"};
    const contextNotice = {id:"coi-reading-context",kind:"coi",coiType:"article-notice",sourceTitle:"Talk:Fixture Corporation",sourceRevision:777,
      sourceUrl:"https://en.wikipedia.org/w/index.php?title=Talk%3AFixture_Corporation&oldid=777",
      connection:"This existing notice provides a detailed account of the recorded professional connection. ".repeat(24)};
    // Session storage and runtime messages may serialize equivalent evidence
    // with different key order or absent optional values normalized to null.
    const equivalentPaid = {...Object.fromEntries(Object.entries(paidEvidence).reverse()),note:null};
    const {page,context} = await makePage(browser, {
      preference:"tint",responses:[success(scanResult([paidEvidence,contextNotice])),success(scanResult([equivalentPaid,contextNotice,extra],{deep:true}))],
      messageResponses:{GET_CONTRIBUTOR_EDITS:[success(editList)],GET_EDIT_DIFF:[success({...articleEdit,changes:[{before,after}],truncated:false})]},
      heldMessages:{SCAN_ARTICLE:[1]}
    });
    try {
      await waitForStatus(page,"Paid involvement disclosed");
      await openToolbar(page);
      await page.locator(".change-unified").waitFor();
      await page.getByRole("button",{name:"See More...",exact:true}).click();
      await page.locator(".card").first().evaluate(node=>{window.__existingCard=node;window.__existingParagraph=node.querySelector(".change-unified");window.__existingToggle=node.querySelector(".paragraph-toggle");});
      await page.locator(".card").first().locator(":scope > .card-label").click();
      assert.equal(await page.locator(".card").first().evaluate(node=>node.open),false);
      await page.locator(".page-tint").evaluate(node=>{window.__existingTint=node;});
      await page.getByRole("button",{name:"Check more sources",exact:true}).evaluate(node=>{window.__deepButton=node;});
      await page.getByRole("button",{name:"Check more sources",exact:true}).click();
      const checking = page.getByRole("button",{name:/Checking/});
      await checking.waitFor();
      assert.equal(await checking.isDisabled(),true);
      assert.equal(await checking.evaluate(node=>node===window.__deepButton&&node.isConnected),true);
      assert.equal(await page.locator(".card").count(),2);
      assert.equal(await page.locator(".card").first().evaluate(node=>node===window.__existingCard&&!node.open),true);
      assert.equal(await page.locator(".card").first().locator(":scope > .card-body").isVisible(),false);
      assert.equal(await page.locator(".page-tint").isVisible(),true);
      assert.equal(await page.locator(".page-tint").evaluate(node=>node===window.__existingTint),true);
      const scrollBefore = await page.locator(".scroll").evaluate(node=>node.scrollTop);
      assert.ok(scrollBefore>0,"This fixture should exercise the panel while it is scrolled.");
      const requestsBefore = await page.evaluate(()=>window.__requests.filter(request=>request.type!=="SCAN_ARTICLE"));
      await releaseRequest(page,"SCAN_ARTICLE",1);
      await page.getByRole("link",{name:"Source revision 54321",exact:true}).waitFor();
      assert.equal(await page.locator(".card").count(),3);
      const first = page.locator(".card").first();
      assert.equal(await first.evaluate(node=>node===window.__existingCard),true);
      assert.equal(await first.evaluate(node=>node.open),false);
      assert.equal(await first.locator(":scope > .card-body").isVisible(),false);
      assert.equal(await page.locator(".card").last().evaluate(node=>node.open),true,"New findings should open by default without reopening existing cards.");
      assert.equal(await first.locator(".change-unified").evaluate(node=>node===window.__existingParagraph),true);
      assert.equal(await first.locator(".paragraph-toggle").evaluate(node=>node===window.__existingToggle),true);
      assert.equal(await first.locator(".paragraph-toggle").getAttribute("aria-expanded"),"true");
      assert.equal(await first.locator(".change-text").textContent(),after);
      assert.ok(Math.abs(await page.locator(".scroll").evaluate(node=>node.scrollTop)-scrollBefore)<=1,"Appending findings should preserve the current scroll position.");
      assert.deepEqual(await page.evaluate(()=>window.__requests.filter(request=>request.type!=="SCAN_ARTICLE")),requestsBefore,"A second disclosure for the same editor should reuse loaded status, history and changes.");
      await first.locator(":scope > .card-label").click();
      assert.equal(await first.locator(":scope > .card-body").isVisible(),true);
      await first.locator(".paragraph-toggle").click();
      assert.equal(await first.locator(".paragraph-toggle").getAttribute("aria-expanded"),"false");
    } finally {await context.close();}
  });

  await check("a newer deep snapshot removes obsolete disclosures and replaces changed source revisions", async () => {
    const revised = {...paidEvidence,sourceRevision:54322,sourceTimestamp:"2026-10-30T16:00:00Z",
      sourceUrl:"https://en.wikipedia.org/w/index.php?title=Talk%3AFixture_Corporation&oldid=54322"};
    for (const replacement of [[],[revised]]) {
      const {page,context} = await makePage(browser, {
        preference:"tint",responses:[success(scanResult([paidEvidence])),success(scanResult(replacement,{deep:true}))],
        heldMessages:{SCAN_ARTICLE:[1]}
      });
      try {
        await waitForStatus(page,"Paid involvement disclosed");
        await openToolbar(page);
        await page.locator(".card").evaluate(node=>{window.__obsoleteCard=node;});
        await page.locator(".card > .card-label").click();
        await page.getByRole("button",{name:"Check more sources",exact:true}).click();
        assert.equal(await page.locator(".card").count(),1,"Keep the current evidence visible until the newer snapshot arrives.");
        assert.equal(await page.locator(".page-tint").isVisible(),true);
        await releaseRequest(page,"SCAN_ARTICLE",1);
        await page.waitForFunction(()=>window.__completedRequests.filter(type=>type==="SCAN_ARTICLE").length===2);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
        assert.equal(await page.getByRole("link",{name:"Source revision 12345",exact:true}).count(),0);
        assert.equal(await page.evaluate(()=>window.__obsoleteCard.isConnected),false);
        assert.equal(await page.locator(".card").count(),replacement.length);
        if (replacement.length) {
          assert.equal(await page.locator(".card").evaluate(node=>node.open),false,"Replacing a changed card with the same key should retain its collapsed state.");
          assert.equal(await page.locator(".card > .card-body").isVisible(),false);
          await page.locator(".card > .card-label").click();
          assert.equal(await page.getByRole("link",{name:"Source revision 54322",exact:true}).getAttribute("href"),revised.sourceUrl);
          assert.equal(await page.locator(".page-tint").isVisible(),true);
        } else {
          await waitForStatus(page,"No disclosure found");
          await assertQuiet(page);
          assert.equal(await page.locator('.card[data-kind="paid-disclosure"]').count(),0);
        }
      } finally {await context.close();}
    }
  });

  await check("the broader check explains its scope in a tooltip without adding a summary line", async () => {
    const deepSummary = "Checked 4 talk archives and 5 user pages. Requests may be historical and do not establish payment.";
    const { page, context } = await makePage(browser, { responses: [
      success(scanResult([paidEvidence])),
      success(scanResult([paidEvidence], { deep: true, deepSummary }))
    ] });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      const checkMore = page.getByRole("button", { name: "Check more sources", exact: true });
      assert.match(await checkMore.getAttribute("title"), /5.*archives.*8.*user pages/i);
      await checkMore.click();
      await page.waitForFunction(() => window.__completedRequests.filter(type => type === "SCAN_ARTICLE").length === 2);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      assert.equal(await page.getByText(deepSummary, { exact: true }).count(), 0);
      assert.equal(await page.locator(".source-check-hint").count(), 0);
      assert.equal((await page.evaluate(() => window.__requests)).filter(request => request.type === "SCAN_ARTICLE").at(-1).deep, true);
    } finally { await context.close(); }
  });

  await check("COI cards explain a declared connection and group distinct archived requests", async () => {
    const archive = "Talk:Fixture Corporation/Archive 1";
    const archiveUrl = "https://en.wikipedia.org/w/index.php?title=Talk%3AFixture_Corporation%2FArchive_1&oldid=1173563426";
    const connected = {
      ...paidEvidence, id: "coi-connection", kind: "coi", coiType: "connected-contributor",
      contributor: "192.0.2.34", employer: undefined, sourceRole: "talk",
      connection: "This editor states that they are a friend of the article subject.", declarationStatus: "declared"
    };
    const requests = [
      { id: "request-1", sectionTitle: "Career wording", requestSummary: "Requested a change to the career description.", requestStatus: "declined" },
      { id: "request-2", sectionTitle: "Reply 16-APR-2019", topicTitle: "New edit request", requestSummary: "New edit request", requestSummaryExplicit: false,
        contextExcerpt: "The requester asks to update the article with sources published since their earlier work.", requestStatus: "answered" },
      { id: "request-3", sectionTitle: "Sources for recognition", requestSummary: "Proposed additional recognition sources.", requestStatus: "open" }
    ].map(request => ({ ...request, sourceUrl: archiveUrl, sectionUrl: `${archiveUrl}#${request.sectionTitle.replaceAll(" ", "_")}` }));
    const group = {
      id: "coi-request-group", kind: "coi", coiType: "edit-request-group", sourceRole: "archive",
      sourceTitle: archive, sourceUrl: archiveUrl, sourceRevision: 1173563426,
      requestCount: requests.length, requests
    };
    const { page, context } = await makePage(browser, { preference: "tint", responses: [success(scanResult([connected, group], { deep: true }))] });
    try {
      await waitForStatus(page, "COI notice");
      await assertQuiet(page);
      await openToolbar(page);
      assert.equal(await page.locator(".card").count(), 2);
      const connection = page.locator(".card").filter({ hasText: "192.0.2.34" });
      assert.equal(await connection.locator(".card-label").innerText(), "Connected contributor");
      assert.match(await connection.locator(".coi-explanation").innerText(), /friend of the article subject/);
      assert.equal(await connection.locator(".editor-link").getAttribute("href"), "https://en.wikipedia.org/wiki/Special:Contributions/192.0.2.34");
      const requestCard = page.locator(".card").filter({ has: page.locator(".coi-request") });
      assert.match(await requestCard.locator(".card-label").innerText(), /COI edit requests.*3/);
      assert.match(await requestCard.locator(".coi-origin").innerText(), /Archived discussion/);
      assert.equal(await requestCard.locator(".coi-request").count(), 3);
      await requestCard.getByText("View 3 requests", { exact: true }).click();
      for (const request of requests) {
        const label = request.topicTitle || request.sectionTitle;
        const row = requestCard.locator(".coi-request").filter({ hasText: label });
        const link = row.getByRole("link", { name: label, exact: true });
        assert.equal(await link.getAttribute("href"), request.sectionUrl);
        if (request.requestSummaryExplicit === false) {
          assert.equal(await row.locator(".coi-request-summary").innerText(), `Discussion excerpt: ${request.contextExcerpt}`);
          assert.doesNotMatch(await row.innerText(), /Proposed change: New edit request|Reply 16-APR-2019/);
        } else assert.ok((await row.innerText()).includes(request.requestSummary));
      }
      const answered = requestCard.locator(".coi-request").filter({ hasText: "New edit request" });
      assert.match(await answered.innerText(), /answered/i);
      assert.equal(await answered.getByText("Accepted", { exact: true }).count(), 0);
      assert.equal(await answered.getByText("Implemented", { exact: true }).count(), 0);
      assert.match(await page.locator(".scroll").innerText(), /payment (?:is )?not established|does not establish payment|not proof of payment/i);
      await page.getByRole("dialog").screenshot({ path: path.join(artifacts, engineName === "webkit" ? "coi-context.png" : "coi-context-chromium.png") });
    } finally { await context.close(); }
  });

  await check("COI notices state when the relationship is unspecified and keep context inert", async () => {
    const malicious = '<img src=x onerror="window.__coiXss=true"><script>window.__coiXss=true</script>';
    const evidence = [
      { ...paidEvidence, id: "coi-unspecified", kind: "coi", coiType: "connected-contributor", employer: undefined,
        connection: "The notice lists a personal or professional connection; the relationship is not specified.", declarationStatus: "unspecified" },
      { id: "coi-request-unsafe", kind: "coi", coiType: "edit-request", sourceRole: "archive",
        sourceTitle: "Talk:Fixture Corporation/Archive 1", sourceUrl: paidEvidence.sourceUrl, sourceRevision: 12345,
        sectionTitle: "Unverified request", sectionUrl: "javascript:alert(1)", requestSummary: malicious,
        contextExcerpt: malicious, requestStatus: "answered" }
    ];
    const { page, context } = await makePage(browser, { responses: [success(scanResult(evidence))] });
    try {
      await waitForStatus(page, "COI notice");
      await openToolbar(page);
      assert.match(await page.locator(".coi-explanation").first().innerText(), /relationship is not specified/);
      assert.match(await page.locator(".card").last().textContent(), /<img src=x/);
      assert.equal(await page.locator(".card img,.card script").count(), 0);
      const destinations = await page.locator(".card a").evaluateAll(nodes => nodes.map(node => node.href));
      assert.ok(destinations.every(href => new URL(href).origin === "https://en.wikipedia.org"));
      assert.equal(await page.evaluate(() => window.__coiXss), undefined);
      await assertQuiet(page);
    } finally { await context.close(); }
  });

  await check("failed checks can retry without an article warning", async () => {
    const { page, context } = await makePage(browser, { responses: [{ ok: false, error: "Wikipedia could not be reached." }, success(scanResult([paidEvidence]))] });
    try {
      await waitForStatus(page, "Check unavailable");
      await assertQuiet(page);
      await openToolbar(page);
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await waitForStatus(page, "Paid involvement disclosed");
      assert.equal(await page.locator(".launcher").isVisible(), true);
      assert.equal(await page.evaluate(() => window.__requests[1].refresh), true);
    } finally { await context.close(); }
  });

  await check("evidence remains text and unsafe source URLs are omitted", async () => {
    const unsafe = { ...paidEvidence, contributor: '<img src=x onerror="window.__xss=true">', heading: '<img src=x onerror="window.__xss=true">', excerpt: '<a href="javascript:alert(1)">untrusted source</a>', sourceUrl: "javascript:alert(1)" };
    const { page, context } = await makePage(browser, { responses: [success(scanResult([unsafe]))] });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      assert.match(await page.locator(".card").textContent(), /<img/);
      assert.equal(await page.locator(".card img,.card script").count(), 0);
      const destinations = await page.locator(".card a").evaluateAll(nodes => nodes.map(node => node.href));
      assert.ok(destinations.every(href => new URL(href).origin === "https://en.wikipedia.org"));
      assert.equal(await page.evaluate(() => window.__xss), undefined);
    } finally { await context.close(); }
  });

  await check("Escape closes the panel and restores the top-alert focus", async () => {
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence]))] });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      assert.equal(await page.getByRole("button", { name: "Close", exact: true }).evaluate(node => node === node.getRootNode().activeElement), true);
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").isVisible(), false);
      assert.equal(await page.locator(".launcher").evaluate(node => node === node.getRootNode().activeElement), true);
    } finally { await context.close(); }
  });

  await check("toolbar panels restore a focused article opener on unmarked pages", async () => {
    const { page, context } = await makePage(browser);
    try {
      await waitForStatus(page, "No disclosure found");
      await page.locator("#article-link").focus();
      await openToolbar(page);
      await page.getByRole("button", { name: "Close", exact: true }).click();
      assert.equal(await page.locator("#article-link").evaluate(node => node === document.activeElement), true);
      await assertQuiet(page);
    } finally { await context.close(); }
  });

  await check("toolbar panels use the article heading as a temporary keyboard-focus fallback", async () => {
    const { page, context } = await makePage(browser);
    try {
      await waitForStatus(page, "No disclosure found");
      await page.evaluate(() => document.activeElement?.blur());
      await openToolbar(page);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#firstHeading").evaluate(node => node === document.activeElement), true);
      await page.locator("#article-link").focus();
      assert.equal(await page.locator("#firstHeading").evaluate(node => node.hasAttribute("tabindex")), false);
      await assertQuiet(page);
    } finally { await context.close(); }
  });

  await check("page tint stays visible on a dark article without intercepting controls", async () => {
    const { page, context } = await makePage(browser, { preference: "tint", responses: [success(scanResult([paidEvidence]))] });
    try {
      await page.addStyleTag({ content: "body{background:#101418;color:#e8edf1}header{background:#101418;color:#c5ccd4}aside{background:#202730;border-color:#59646e}h1{border-color:#59646e}a{color:#8ab4f8}" });
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".page-tint").waitFor({ state: "visible" });
      const tint = await page.locator(".page-tint").evaluate(node => {
        const css = getComputedStyle(node);
        return { blend: css.mixBlendMode, background: css.backgroundColor, events: css.pointerEvents };
      });
      assert.equal(tint.blend, "normal");
      assert.match(tint.background, /^rgba\(/);
      assert.equal(tint.events, "none");
      await page.locator("#article-button").click();
      assert.equal(await page.evaluate(() => window.__articleClicked), true);
      await page.screenshot({ path: path.join(artifacts, engineName === "webkit" ? "page-tint-dark.png" : "page-tint-dark-chromium.png") });
    } finally { await context.close(); }
  });

  await check("positive findings retain a visible incomplete-check qualifier", async () => {
    const { page, context } = await makePage(browser, { responses: [success(scanResult([paidEvidence], { complete: false, warnings: ["Some archives were unavailable."] }))] });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      assert.match(await page.locator(".status-detail").innerText(), /Check incomplete/);
      assert.equal(await page.locator(".status-detail").isVisible(), true);
      assert.equal(await page.locator(".launcher").isVisible(), true);
      assert.equal(await page.getByText("Sources checked", { exact: true }).count(), 0);
      assert.equal(await page.locator(".coverage,.source-meta").count(), 0);
      assert.equal(await page.getByText("Some archives were unavailable.", { exact: true }).count(), 0);
    } finally { await context.close(); }
  });

  await check("historical views retain a short current-source notice", async () => {
    const { page, context } = await makePage(browser, { url: "https://en.wikipedia.org/w/index.php?title=Fixture_Corporation&oldid=12345" });
    try { await waitForStatus(page, "No disclosure found"); await openToolbar(page); assert.match(await page.locator(".warning:visible").innerText(), /current|Current/); }
    finally { await context.close(); }
  });

  await check("compact evidence panel fits a narrow viewport", async () => {
    const evidence = Array.from({ length: 6 }, (_, index) => ({ ...paidEvidence, id: `paid-${index}` }));
    const { page, context } = await makePage(browser, { viewport: { width: 390, height: 700 }, responses: [success(scanResult(evidence))] });
    try {
      await waitForStatus(page, "Paid involvement disclosed");
      await page.locator(".launcher").click();
      const rect = await page.getByRole("dialog").boundingBox();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= 390, JSON.stringify(rect));
      assert.ok(rect.y >= 0 && rect.y + rect.height <= 700, JSON.stringify(rect));
      assert.equal(await page.locator(".scroll").evaluate(node => node.scrollHeight > node.clientHeight), true);
    } finally { await context.close(); }
  });

  await check("Chrome runtime fallback remains compatible", async () => {
    const { page, context } = await makePage(browser, { runtime: "chrome" });
    try { await waitForStatus(page, "No disclosure found"); await assertQuiet(page); } finally { await context.close(); }
  });

  await check("non-article/edit/history/diff views remain untouched", async () => {
    for (const options of [
      { namespace: "ns-1", url: "https://en.wikipedia.org/wiki/Talk:Fixture_Corporation" },
      { url: "https://en.wikipedia.org/w/index.php?title=Fixture_Corporation&action=edit" },
      { url: "https://en.wikipedia.org/w/index.php?title=Fixture_Corporation&action=history" },
      { url: "https://en.wikipedia.org/w/index.php?title=Fixture_Corporation&diff=12345" }
    ]) {
      const { page, context } = await makePage(browser, options);
      try { assert.equal(await page.locator("#wikipaidia-extension-root").count(), 0); assert.equal(await page.evaluate(() => window.__requests.length), 0); }
      finally { await context.close(); }
    }
  });

  console.log(`\n${checks - failures}/${checks} ${engineName} browser checks passed.`);
} finally { await browser?.close(); }
if (failures) process.exitCode = 1;
