import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = path.join(root, "extension");
// Branded Chrome and Edge no longer support the side-loading flags; Playwright's
// Chromium channel does. An explicit executable remains available for testing
// with another browser build that supports unpacked extensions.
const chromePath = process.env.WIKIPAIDIA_CHROME_PATH;
if (chromePath) await access(chromePath);
const profile = await mkdtemp(path.join(os.tmpdir(), "wikipaidia-extension-test-"));
const artifacts = path.join(root, "test-results", "extension-chromium");
await mkdir(artifacts, { recursive: true });

function fixturePage(title, ns, revid, content) {
  return { pageid: revid, ns, title, revisions: [{ revid, timestamp: "2026-10-01T12:00:00Z", slots: { main: { contentmodel: "wikitext", contentformat: "text/x-wiki", content } } }] };
}

const paragraphBefore = "Earlier unchanged context about the company and its history. ".repeat(22) + "The founder stepped down in 2021 but remained chairman. " + "Later unchanged context about operations and public reporting. ".repeat(22);
const paragraphAfter = paragraphBefore.replace("2021 but", "2021, but");

const edits = Array.from({length:6}, (_,index) => ({
  revid:9006-index,parentid:9005-index,user:"FixtureEditor",
  timestamp:`2023-08-${String(20-index).padStart(2,"0")}T12:00:00Z`,comment:`Edit ${index+1}`
}));
const pages = {
  "Fixture Corporation": fixturePage("Fixture Corporation", 0, 10001, "'''Fixture Corporation''' is a fictional company used only in an automated test."),
  "Talk:Fixture Corporation": fixturePage("Talk:Fixture Corporation", 1, 10002,
    "{{Connected contributor (paid)|User1=FixtureEditor|U1-employer=Fixture Corporation|U1-client=Fixture Corporation|U1-EH=yes|U1-otherlinks=Freelancer; disclosed [https://en.wikipedia.org/wiki/User:FixtureEditor here]}}"),
  "Talk:Fixture Corporation/Archive 1": fixturePage("Talk:Fixture Corporation/Archive 1", 1, 10003,
    "{{Connected contributor|User1=FixtureVolunteer|U1-declared=yes|U1-otherlinks=This editor states that they are a former colleague of the subject.}}\n" +
    "== Career wording ==\n{{edit COI|D|summary=Requested a change to the career description.}}\nPlease review the career description.\n" +
    "== Biography update ==\n{{edit COI|answered=yes|summary=Asked to update biographical details.}}\nPlease review the biography update.\n" +
    "== Sources for recognition ==\n{{edit COI|summary=Proposed additional recognition sources.}}\nPlease review the added sources.\n"),
  "User:FixtureEditor": fixturePage("User:FixtureEditor", 2, 10004,
    "{{Paid|employer=Fixture Corporation|article=[[Fixture Corporation]]|some=yes}}")
};

let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    ...(chromePath ? { executablePath: chromePath } : { channel: "chromium" }),
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, "--disable-background-networking"]
  });

  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20000 });
  assert.match(worker.url(), /chrome-extension:\/\/[^/]+\/background\.js$/);
  const extensionId = new URL(worker.url()).hostname;
  await worker.evaluate(({ pages, paragraphBefore, paragraphAfter, edits }) => {
    globalThis.__apiCalls = [];
    globalThis.__runtimeErrors = [];
    self.addEventListener("error", event => globalThis.__runtimeErrors.push(String(event.message)));
    self.addEventListener("unhandledrejection", event => globalThis.__runtimeErrors.push(String(event.reason)));
    // Replace only this isolated extension worker's network function. The real
    // client, scanner, parser, cache, runtime listener and content script execute.
    globalThis.fetch = async (input, options = {}) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      if (url.origin !== "https://en.wikipedia.org" || url.pathname !== "/w/api.php") throw new Error("Unexpected API destination in extension test.");
      globalThis.__apiCalls.push({ url: url.href, credentials: options.credentials, headers: options.headers });
      const revisionId = Number(url.searchParams.get("revids") || url.searchParams.get("torev"));
      const articleRevision = edits.find(edit => edit.revid === revisionId);
      if (url.searchParams.get("action") === "compare") {
        if (!articleRevision || Number(url.searchParams.get("fromrev")) !== articleRevision.parentid) throw new Error("Unexpected comparison revision.");
        return new Response(JSON.stringify({ compare: {
          fromrevid: articleRevision.parentid, torevid: articleRevision.revid, fromns: 0, tons: 0,
          fromtitle: "Fixture Corporation", totitle: "Fixture Corporation",
          body: `<table class="diff"><tr><td class="diff-marker">−</td><td class="diff-deletedline"><div>${paragraphBefore}</div></td><td class="diff-marker">+</td><td class="diff-addedline"><div>${paragraphAfter.replace("2021, but", '2021<ins class="diffchange diffchange-inline">,</ins> but')}</div></td></tr></table>`
        }}), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      let query;
      if (url.searchParams.get("list") === "allpages") {
        query = { allpages: [{ pageid: 10003, ns: 1, title: "Talk:Fixture Corporation/Archive 1" }] };
      } else if (url.searchParams.get("list") === "users") {
        if (url.searchParams.get("usprop") !== "blockinfo") throw new Error("Unexpected user status lookup.");
        query = { users: (url.searchParams.get("ususers") || "").split("|").map(name => name === "FixtureEditor" ? {
          userid:123,name,blockid:42,blockedby:"FixtureAdministrator",blockedtimestamp:"2024-01-20T17:42:10Z",
          blockexpiry:"infinite",blockpartial:false,
          blockreason:"Abusing multiple accounts: Please see: [[Wikipedia:Sockpuppet investigations/Fixture case|the recorded investigation]]"
        } : {userid:124,name}) };
      } else if (url.searchParams.get("rvuser") === "FixtureEditor") {
        query = { pages: [{ pageid: 10001, ns: 0, title: "Fixture Corporation", revisions: edits }] };
      } else if (url.searchParams.has("revids")) {
        if (!articleRevision) throw new Error("Unexpected edit metadata lookup.");
        query = { pages: [{ pageid: 10001, ns: 0, title: "Fixture Corporation", revisions: [articleRevision] }] };
      } else if (url.searchParams.get("rvprop") === "user|userid") {
        query = { pages: [{ pageid: 10001, ns: 0, title: "Fixture Corporation", revisions: [{ user: "FixtureEditor", userid: 123 }] }] };
      } else {
        const requestedTitles = (url.searchParams.get("titles") || "").split("|");
        query = { pages: requestedTitles.map(title => {
          if (!pages[title]) throw new Error(`Unexpected source page in extension test: ${title}`);
          return pages[title];
        }) };
      }
      return new Response(JSON.stringify({ batchcomplete: true, query }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
  }, { pages, paragraphBefore, paragraphAfter, edits });

  await context.route("https://en.wikipedia.org/**", route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture Corporation — Wikipedia</title><link rel="canonical" href="https://en.wikipedia.org/wiki/Fixture_Corporation"><style>body{font-family:Georgia,serif;margin:65px;color:#202122}h1{font-size:32px;font-weight:normal;border-bottom:1px solid #a2a9b1}p{max-width:700px;line-height:1.8}</style></head><body class="ns-0 action-view"><h1 id="firstHeading">Fixture Corporation</h1><p>From Wikipedia, the free encyclopedia</p><p>This fictional test article validates the installed Wikipaidia extension. All API responses come from an isolated test fixture.</p></body></html>`
  }));

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const sourceCallCount = () => worker.evaluate(() => globalThis.__apiCalls.filter(call => new URL(call.url).searchParams.get("rvprop") === "ids|timestamp|content").length);
  await page.goto("https://en.wikipedia.org/wiki/Fixture_Corporation");
  await page.locator(".status-title").filter({hasText:"Paid involvement disclosed"}).waitFor({state:"attached",timeout:20000});
  assert.equal(await sourceCallCount(),1);
  assert.equal(await worker.evaluate(()=>globalThis.__apiCalls.some(call=>new URL(call.url).searchParams.has("rvuser"))),false);
  assert.equal(await worker.evaluate(()=>globalThis.__apiCalls.some(call=>new URL(call.url).searchParams.get("list")==="users")),false);
  await page.locator(".launcher").click();
  const firstCard=page.locator(".card").first();
  await firstCard.locator(".change-unified").nth(2).waitFor({timeout:20000});
  assert.equal(await firstCard.locator(".edit-row").count(),3);
  assert.deepEqual(await firstCard.locator(".edit-comment").allTextContents(),["Edit 1","Edit 2","Edit 3"]);
  assert.equal(await firstCard.getByRole("button",{name:"Show article edits",exact:true}).count(),0);
  assert.equal(await firstCard.getByRole("button",{name:"Show changes",exact:true}).count(),0);
  const source=firstCard.getByRole("link",{name:"Source revision 10002",exact:true});
  assert.equal(new URL(await source.getAttribute("href")).searchParams.get("oldid"),"10002");
  console.log("PASS real extension defers history until opening the panel and automatically displays the three latest changes");

  await firstCard.locator(".block-badge").waitFor();
  assert.equal(await firstCard.locator(".block-badge").innerText(),"User Blocked");
  assert.equal(await firstCard.locator(".block-reason").innerText(),"Abusing multiple accounts");
  const reasonLink=firstCard.locator(".block-reason a");
  assert.equal(await reasonLink.getAttribute("href"),"https://en.wikipedia.org/wiki/Wikipedia:Sockpuppet_investigations/Fixture_case");
  assert.equal(await reasonLink.getAttribute("target"),"_blank");
  assert.match(await reasonLink.getAttribute("rel"),/noopener/);
  const editorValue=firstCard.locator(".facts dd").filter({has:page.locator(".editor-link")});
  assert.equal(await editorValue.locator(":scope > .editor-status").count(),1);
  assert.equal(await firstCard.locator(".editor-link").evaluate(node=>node.nextElementSibling?.classList.contains("editor-status")),true);
  assert.equal(await firstCard.locator(".block-meta").getByText("On: Jan 20, 2024",{exact:true}).count(),1);
  assert.equal(await firstCard.locator(".block-meta").getByText("Duration: Indefinite",{exact:true}).count(),1);
  assert.equal(await firstCard.getByRole("link",{name:"Block log",exact:true}).count(),0);
  assert.doesNotMatch(await firstCard.locator(".editor-status").innerText(),/Please see|Fixture case|the recorded investigation/);
  console.log("PASS current block info appears below the editor with labeled dates and its reason linked to the recorded investigation");

  const firstRow=firstCard.locator(".edit-row").first();
  assert.equal(await firstRow.locator(".edit-date").getAttribute("title"),edits[0].timestamp);
  assert.equal(await firstRow.locator(".edit-meta").getByRole("link",{name:"Diff 9006",exact:true}).count(),1);
  const compact=await firstRow.locator(".change-text").textContent();
  assert.ok(compact.length<paragraphAfter.length/4);
  assert.match(compact,/2021, but/);
  assert.equal(await firstRow.locator(".change-unified .paragraph-toggle").count(),1);
  await firstRow.getByRole("button",{name:"See More...",exact:true}).click();
  assert.ok(paragraphAfter.length>1500);
  assert.equal(await firstRow.locator(".change-text").textContent(),paragraphAfter);
  await firstRow.getByRole("button",{name:"See Less...",exact:true}).click();
  assert.equal(await firstRow.locator(".change-text").textContent(),compact);
  assert.deepEqual(await firstRow.locator(".diff-add").allTextContents(),[","]);
  assert.equal(await firstRow.locator(".diff-remove").count(),0);
  console.log("PASS real comparison previews preserve exact comma marks and expand full paragraphs from inside the text box");

  await firstCard.getByRole("button",{name:"See 3 more edits",exact:true}).click();
  await firstCard.locator(".change-unified").nth(5).waitFor({timeout:20000});
  assert.equal(await firstCard.locator(".edit-row").count(),6);
  await firstCard.getByRole("button",{name:"See fewer edits",exact:true}).click();
  assert.equal(await firstCard.locator(".edit-row").count(),3);
  const editCalls=await worker.evaluate(()=>globalThis.__apiCalls);
  const compared=editCalls.filter(call=>new URL(call.url).searchParams.get("action")==="compare");
  assert.equal(compared.length,6);
  assert.ok(editCalls.some(call=>new URL(call.url).searchParams.get("rvlimit")==="500"));
  assert.ok(editCalls.every(call=>call.credentials==="omit"));
  console.log("PASS exact remaining edit counts expand the rest and collapse back to three");

  await page.reload();
  await page.locator(".status-title").filter({hasText:"Paid involvement disclosed"}).waitFor({state:"attached"});
  assert.equal(await sourceCallCount(),1);
  await page.locator(".launcher").click();
  assert.equal(await page.getByText("Sources checked",{exact:true}).count(),0);
  assert.equal(await page.locator(".coverage,.source-meta").count(),0);
  assert.equal(await page.getByText("Cached",{exact:true}).count(),0);
  console.log("PASS disclosure source checks continue to use session cache");

  await page.getByRole("button",{name:"Refresh",exact:true}).click();
  await page.getByRole("button",{name:"Refresh",exact:true}).waitFor();
  await page.locator(".status-title").filter({hasText:"Paid involvement disclosed"}).waitFor({state:"attached"});
  assert.equal(await sourceCallCount(),2);
  console.log("PASS refresh bypasses source cache");

  // Refresh keeps the previous block rendering visible while its current lookup
  // waits for the API scheduler. Include that lookup before measuring reuse.
  await worker.evaluate(async()=>{
    const deadline=Date.now()+20000;
    const count=()=>globalThis.__apiCalls.filter(call=>{
      const params=new URL(call.url).searchParams;
      return params.get("list")==="users"&&params.get("ususers")==="FixtureEditor";
    }).length;
    while(count()<3){
      if(Date.now()>deadline) throw new Error("Refresh did not recheck the editor’s block status.");
      await new Promise(resolve=>setTimeout(resolve,10));
    }
  });
  await page.locator(".card").first().locator(".change-unified").nth(2).waitFor();
  await page.locator(".card").first().locator(".block-badge").waitFor();
  await page.locator(".card").first().getByRole("button",{name:"See More...",exact:true}).first().click();
  await page.locator(".card").first().evaluate(node=>{window.__existingCard=node;window.__existingParagraph=node.querySelector(".change-unified");});
  await page.locator(".card").first().locator(":scope > .card-label").click();
  assert.equal(await page.locator(".card").first().evaluate(node=>node.open),false);
  assert.equal(await page.locator(".card").first().locator(":scope > .card-body").isVisible(),false);
  const callsBeforeDeep=await worker.evaluate(()=>globalThis.__apiCalls);
  const currentContentCalls=calls=>calls.filter(call=>{
    const params=new URL(call.url).searchParams;
    return params.get("rvprop")==="ids|timestamp|content"&&(params.get("titles")||"").split("|").some(title=>["Fixture Corporation","Talk:Fixture Corporation"].includes(title));
  }).length;
  const historyCalls=calls=>calls.filter(call=>new URL(call.url).searchParams.get("rvuser")==="FixtureEditor").length;
  const editorDataCalls=calls=>calls.filter(call=>{
    const params=new URL(call.url).searchParams;
    return params.get("rvuser")==="FixtureEditor"||params.get("ususers")==="FixtureEditor"||params.get("action")==="compare";
  }).length;
  await page.getByRole("button",{name:"Check more sources",exact:true}).click();
  await page.getByRole("link",{name:"Source revision 10004",exact:true}).waitFor();
  assert.equal(await page.locator(".card").count(),4);
  assert.equal(await page.locator(".card").first().evaluate(node=>node===window.__existingCard),true);
  assert.equal(await page.locator(".card").first().evaluate(node=>node.open),false);
  assert.equal(await page.locator(".card").first().locator(":scope > .card-body").isVisible(),false);
  assert.equal(await page.locator(".card").last().evaluate(node=>node.open),true);
  assert.equal(await page.locator(".card").first().locator(".change-unified").first().evaluate(node=>node===window.__existingParagraph),true);
  assert.equal(await page.locator(".card").first().locator(".change-text").first().textContent(),paragraphAfter);
  const callsAfterDeep=await worker.evaluate(()=>globalThis.__apiCalls);
  assert.equal(currentContentCalls(callsAfterDeep),currentContentCalls(callsBeforeDeep),"The broader check should reuse the current article and talk-page source result.");
  assert.equal(historyCalls(callsAfterDeep),historyCalls(callsBeforeDeep),"Existing article histories should be reused while new sources are appended.");
  assert.equal(editorDataCalls(callsAfterDeep),editorDataCalls(callsBeforeDeep),"A collapsed card should keep its existing block and edit data without fetching it again.");
  const retainedHeader=page.locator(".card").first().locator(":scope > .card-label");
  await retainedHeader.focus();
  await retainedHeader.press("Space");
  assert.equal(await page.locator(".card").first().locator(":scope > .card-body").isVisible(),true);
  assert.equal(await page.locator(".card").first().locator(".paragraph-toggle").first().getAttribute("aria-expanded"),"true");
  assert.equal(await page.locator(".card").first().locator(".block-reason").textContent(),"Abusing multiple accounts");
  assert.equal(editorDataCalls(await worker.evaluate(()=>globalThis.__apiCalls)),editorDataCalls(callsBeforeDeep));
  assert.doesNotMatch(await page.locator(".scroll").innerText(),/Checked \d+ talk archives? and \d+ user pages/);
  console.log("PASS broader checks preserve collapsed cards, expanded previews and block data without fetching existing sources again");
  const connected=page.locator(".card").filter({hasText:"FixtureVolunteer"});
  assert.match(await connected.locator(".coi-explanation").innerText(),/former colleague/);
  const requestGroup=page.locator(".card").filter({has:page.locator(".coi-request")});
  assert.match(await requestGroup.locator(".card-label").innerText(),/COI edit requests.*3/);
  assert.match(await requestGroup.locator(".coi-origin").innerText(),/Archived discussion/);
  assert.equal(await requestGroup.locator(".coi-request").count(),3);
  await requestGroup.getByText("View 3 requests",{exact:true}).click();
  assert.match(await requestGroup.innerText(),/Career wording/);
  assert.match(await requestGroup.innerText(),/declined/i);
  const answered=requestGroup.locator(".coi-request").filter({hasText:"Biography update"});
  assert.match(await answered.innerText(),/answered/i);
  assert.equal(await answered.getByText("Accepted",{exact:true}).count(),0);
  const requestLinks=await requestGroup.locator(".coi-request a").evaluateAll(nodes=>nodes.map(node=>node.href));
  assert.equal(requestLinks.length,3);
  assert.equal(new Set(requestLinks.map(href=>new URL(href).hash)).size,3);
  console.log("PASS real archive parsing explains connected contributors and groups distinct COI requests without asserting implementation");
  const calls=await worker.evaluate(()=>globalThis.__apiCalls);
  assert.ok(calls.some(call=>new URL(call.url).searchParams.get("list")==="allpages"));
  assert.ok(calls.some(call=>new URL(call.url).searchParams.get("rvprop")==="user|userid"));
  assert.ok(calls.every(call=>call.headers["Api-User-Agent"].startsWith("Wikipaidia/")));
  console.log("PASS linked disclosure checks still traverse archive and user sources");

  const style=page.getByRole("combobox",{name:"Alert style",exact:true});
  const color=page.getByLabel("Alert color",{exact:true});
  assert.equal(await page.locator(".topbar .alert-style-picker").count(),1);
  assert.equal(await page.locator(".topbar .alert-color-picker").count(),1);
  assert.equal(await page.locator(".preferences").count(),0);
  await color.evaluate(input=>{input.value="#3366cc";input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));});
  await style.selectOption("tint");
  await page.locator(".page-tint").waitFor({state:"visible"});
  await page.waitForFunction(()=>document.querySelector("#wikipaidia-extension-root").shadowRoot.querySelector(".alert-color-picker").value==="#3366cc");
  const stored=await worker.evaluate(()=>chrome.storage.local.get(["alertStyle","alertColor"]));
  assert.equal(stored.alertStyle,"tint");
  assert.equal(stored.alertColor,"#3366cc");
  assert.match(await page.locator(".page-tint").evaluate(n=>getComputedStyle(n).backgroundColor),/51, 102, 204/);
  const second=await context.newPage();
  await second.goto("https://en.wikipedia.org/wiki/Fixture_Corporation");
  await second.locator(".page-tint").waitFor({state:"visible"});
  assert.equal(await second.getByLabel("Alert color",{exact:true}).inputValue(),"#3366cc");
  console.log("PASS header style/color pickers persist through real extension storage and fresh tabs");

  await style.selectOption("top");
  await second.locator(".page-tint").waitFor({state:"hidden"});
  const banner=await page.locator("#wikipaidia-article-alert").evaluate(n=>getComputedStyle(n).getPropertyValue("--alert-background"));
  assert.equal(await second.locator("#wikipaidia-article-alert").evaluate(n=>getComputedStyle(n).getPropertyValue("--alert-background")),banner);
  await color.evaluate(input=>{input.value="#a02080";input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));});
  await second.waitForFunction(()=>document.querySelector("#wikipaidia-extension-root").shadowRoot.querySelector(".alert-color-picker").value==="#a02080");
  assert.notEqual(await second.locator("#wikipaidia-article-alert").evaluate(n=>getComputedStyle(n).getPropertyValue("--alert-background")),banner);
  console.log("PASS style and color changes update other open article tabs");

  assert.deepEqual(await worker.evaluate(()=>globalThis.__runtimeErrors),[]);
  assert.deepEqual(pageErrors,[]);
  await page.locator(".scroll").evaluate(node=>{node.scrollTop=0;});
  await page.screenshot({path:path.join(artifacts,"installed-extension.png")});
  console.log("PASS no background worker or content-script errors were recorded");
  console.log(`\n12/12 installed-extension checks passed (${extensionId}).`);
  console.log(`Screenshot: ${path.join(artifacts,"installed-extension.png")}`);
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
