// Capture the real extension UI with clearly identified, fictional example data.
// No Wikipedia requests or personal browser profiles are used.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import { chromium, webkit } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "store-submissions", "assets");
const engines = process.argv.slice(2);
if (!engines.length) engines.push("chromium", "webkit");
if (engines.some(engine => !["chromium", "webkit"].includes(engine))) {
  throw new Error("Usage: node scripts/capture-store-assets.mjs [chromium] [webkit]");
}
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(root, "extension/manifest.json"), "utf8"));
const scriptNames = manifest.content_scripts[0].js;
const scripts = await Promise.all(scriptNames.map(name => readFile(path.join(root, "extension", name), "utf8")));
const title = "Example Company";
const editor = "ExampleEditor";
const articleUrl = "https://en.wikipedia.org/wiki/Example_Company";
const evidence = {
  id: "illustrative-paid-disclosure", kind: "paid-disclosure", heading: "Paid involvement listed",
  summary: "A paid contributor is listed in an article-specific disclosure.",
  excerpt: "ExampleEditor has been paid by Example Company.", contributor: editor, employer: title,
  sourceTitle: "Talk:Example Company", sourceRevision: 920010, sourceTimestamp: "2026-10-15T12:00:00Z",
  sourceUrl: "https://en.wikipedia.org/w/index.php?title=Talk%3AExample_Company&oldid=920010",
  template: "connected contributor (paid)", sourceTemplate: "connected contributor (paid)", relationship: "page-notice"
};
const comparisons = [
  ["The company was founded in 1996.", "The company was founded in 1998."],
  ["Its headquarters are in Portland, Oregon.", "Its headquarters are in Portland, Maine."],
  ["The company makes household products.", "The company designs and manufactures household products."]
];
const edits = comparisons.map((_, index) => ({
  revid: 920003 - index, parentid: 920002 - index, user: editor,
  timestamp: `2026-10-${String(14 - index).padStart(2, "0")}T12:00:00Z`,
  comment: ["Corrected the founding year", "Updated the headquarters location", "Clarified the company description"][index],
  diffUrl: `https://en.wikipedia.org/w/index.php?diff=${920003 - index}&oldid=${920002 - index}`
}));
const scan = {
  title, checkedAt: "2026-10-30T12:00:00Z", evidence: [evidence], complete: true, deep: false,
  coverage: ["Current article and talk-page notices checked."], warnings: []
};

const article = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="canonical" href="${articleUrl}"><title>Example Company — illustrative article</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#202122;font:16px/1.65 Georgia,serif}
header{height:78px;border-bottom:1px solid #eaecf0;display:flex;align-items:center;gap:30px;padding:0 64px;font:14px Arial,sans-serif;color:#54595d}
.wordmark{font:23px Georgia,serif;color:#202122}.sample{padding:7px 12px;border:1px solid #a2a9b1;border-radius:4px;font-size:12px;color:#54595d;background:#f8f9fa}
main{margin:32px 64px 40px;width:1152px}.tabs{font:13px Arial,sans-serif;border-bottom:1px solid #a2a9b1;padding-bottom:12px;color:#36c;margin-bottom:20px}.tabs span{margin-right:24px}h1{font-size:32px;line-height:1.3;font-weight:normal;border-bottom:1px solid #a2a9b1;margin:0;padding-bottom:10px}
.article-body{width:730px}.byline{font-size:13px;color:#54595d;margin:9px 0 18px}p{margin:0 0 18px}h2{font-weight:normal;font-size:24px;line-height:1.35;border-bottom:1px solid #a2a9b1;margin:24px 0 12px}a{color:#36c;text-decoration:none}.info{float:right;width:270px;margin:0 0 18px 30px;border:1px solid #a2a9b1;background:#f8f9fa;padding:14px;font:14px/1.6 Arial,sans-serif}.info h3{font-size:16px;text-align:center;margin:0 0 14px}.info p{margin:10px 0}.illustration{height:130px;display:flex;align-items:center;justify-content:center;color:#72777d;border:1px solid #c8ccd1;background:#eaecf0;font-size:12px}.caption{font-size:12px;color:#54595d;margin-top:5px}.note{padding:12px 14px;border-left:3px solid #a2a9b1;background:#f8f9fa;font:13px/1.55 Arial,sans-serif;color:#54595d}
</style></head><body class="ns-0 action-view">
<header><span class="wordmark">Wikipedia-style article</span><span class="sample">Illustrative example · Fictional article and disclosure data</span></header>
<main><div class="tabs"><span>Article</span><span>Talk</span><span>Read</span><span>View history</span></div><h1 id="firstHeading">Example Company</h1>
<div id="mw-content-text"><p class="byline">Demonstration article for Wikipaidia</p>
<aside class="info"><h3>Example Company</h3><div class="illustration">Fictional company</div><p><strong>Founded</strong><br>1998</p><p><strong>Headquarters</strong><br>Portland, Maine</p><p><strong>Industry</strong><br>Household products</p><p class="caption">Illustrative information only.</p></aside>
<div class="article-body"><p><strong>Example Company</strong> is a fictional company used to demonstrate Wikipaidia. The company designs and manufactures household products.</p>
<p>This example shows how a public paid-contributor disclosure can be surfaced while reading an article. The extension links to the supporting notice and lets readers inspect the contributor’s article edits.</p>
<h2>History</h2><p>The company was founded in 1998. Its headquarters are in Portland, Maine. These details are illustrative and do not describe a real business.</p>
<p>The sample edit previews demonstrate a corrected year, an updated location, and a change in wording. An editor’s paid relationship does not establish that every edit was paid.</p>
<h2>Products</h2><p>The example company develops household products. This text is provided solely to show the extension alongside an article.</p>
<p class="note">All names, disclosures, dates, edits, and article details shown in this image are fictional example data. The Wikipaidia interface is rendered from the actual extension source.</p></div>
</div></main></body></html>`;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const kind = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc32(Buffer.concat([kind, bytes])));
  return Buffer.concat([length, kind, bytes, checksum]);
}
function png(width, height, channels, rows) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = channels === 3 ? 2 : 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
// WebKit writes RGBA PNGs even for opaque pages. Strip only an entirely opaque
// alpha channel; no screenshot pixels are resized, redrawn, or recolored.
function opaqueScreenshot(bytes) {
  const input = Buffer.from(bytes), width = input.readUInt32BE(16), height = input.readUInt32BE(20);
  assert.equal(width, 1280); assert.equal(height, 800); assert.equal(input[24], 8); assert.equal(input[28], 0);
  if (input[25] === 2) return input;
  assert.equal(input[25], 6);
  const idat = [];
  for (let offset = 8; offset < input.length;) {
    const length = input.readUInt32BE(offset), type = input.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") idat.push(input.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const encoded = inflateSync(Buffer.concat(idat)), stride = width * 4, decoded = Buffer.alloc(stride * height);
  const paeth = (a,b,c) => {const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for (let y = 0; y < height; y++) {
    const filter = encoded[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const a=x>=4?decoded[y*stride+x-4]:0,b=y?decoded[(y-1)*stride+x]:0,c=y&&x>=4?decoded[(y-1)*stride+x-4]:0;
      const prediction = [0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      decoded[y*stride+x] = (encoded[y*(stride+1)+1+x] + prediction) & 255;
    }
  }
  const rgb = Buffer.alloc((width * 3 + 1) * height);
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const source=y*stride+x*4,target=y*(width*3+1)+1+x*3;
    assert.equal(decoded[source+3],255,"Screenshots must be fully opaque before removing alpha.");
    decoded.copy(rgb,target,source,source+3);
  }
  return png(width,height,3,rgb);
}

for (const engine of engines) {
  const browser = await (engine === "webkit" ? webkit.launch({headless:true}) : chromium.launch({channel:"chromium",headless:true}));
  const folder = path.join(output, engine);
  await mkdir(folder, {recursive:true});
  try {
    const context = await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,locale:"en-US",timezoneId:"UTC",reducedMotion:"reduce",colorScheme:"light"});
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.request().url() === articleUrl ? route.fulfill({contentType:"text/html",body:article}) : route.abort());
    await page.addInitScript(({scan,edits,comparisons,editor,engine}) => {
      const preferences = {alertStyle:"top",alertColor:"#eaaa2b"}, listeners = [];
      const success = result => ({ok:true,result});
      window[engine === "webkit" ? "browser" : "chrome"] = {
        runtime:{sendMessage:async message=>{
          if(message.type === "SCAN_ARTICLE") return success(scan);
          if(message.type === "GET_USER_STATUS") return success({user:editor,exists:true,blocked:false});
          if(message.type === "GET_CONTRIBUTOR_EDITS") return success({edits,hasMore:false,totalCount:edits.length});
          if(message.type === "GET_EDIT_DIFF") {
            const index=edits.findIndex(edit=>edit.revid===message.revid);
            if(index<0) throw new Error("Unexpected illustrative revision.");
            return success({...edits[index],changes:[{before:comparisons[index][0],after:comparisons[index][1]}],truncated:false});
          }
          throw new Error("Unexpected illustrative message.");
        },onMessage:{addListener:listener=>{window.__toggleWikipaidia=listener;}}},
        storage:{local:{get:async()=>({...preferences}),set:async values=>{
          const changes={};for(const[key,value]of Object.entries(values)){changes[key]={oldValue:preferences[key],newValue:value};preferences[key]=value;}
          for(const listener of listeners) listener(changes,"local");
        }},onChanged:{addListener:listener=>listeners.push(listener)}}
      };
    }, {scan,edits,comparisons,editor,engine});
    await page.goto(articleUrl);
    for (const script of scripts) await page.addScriptTag({content:script});
    await page.locator(".launcher").waitFor({state:"visible"});
    const capture = async name => {
      const bytes = opaqueScreenshot(await page.screenshot({type:"png",animations:"disabled",omitBackground:false}));
      await writeFile(path.join(folder, name), bytes);
      console.log(`Captured ${engine}/${name}: 1280×800 RGB PNG`);
    };
    await capture("01-banner.png");
    await page.locator(".launcher").click();
    await page.locator(".change-unified").nth(2).waitFor({state:"visible"});
    await page.getByRole("button",{name:"Close",exact:true}).blur();
    // Show the complete source-license notice by using the panel's normal scroll
    // position, without changing its actual layout or hiding any controls.
    await page.locator(".scroll").evaluate(node => {node.scrollTop=node.scrollHeight;});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const attribution = await page.locator(".attribution").boundingBox();
    const scrollBounds = await page.locator(".scroll").boundingBox();
    assert.ok(attribution && scrollBounds && attribution.y >= scrollBounds.y &&
      attribution.y+attribution.height <= scrollBounds.y+scrollBounds.height,
    "The complete attribution note should be readable in the panel viewport.");
    await capture("02-evidence-and-edits.png");
    await page.getByRole("combobox",{name:"Alert style",exact:true}).selectOption("tint");
    await page.locator(".page-tint").waitFor({state:"visible"});
    await page.getByRole("combobox",{name:"Alert style",exact:true}).blur();
    await page.locator(".change-unified").nth(2).waitFor({state:"visible"});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await capture("03-page-tint.png");
    assert.deepEqual(errors, []);
    await writeFile(path.join(folder, "capture.json"), JSON.stringify({
      extensionVersion:manifest.version,renderingEngine:engine,browserVersion:browser.version(),
      viewport:{width:1280,height:800},fictionalExampleData:true,requestsToWikipedia:false,panelScrolledToFooter:true,
      sourceSHA256:Object.fromEntries(scriptNames.map((name,index)=>[name,createHash("sha256").update(scripts[index]).digest("hex")])),
      screenshots:["01-banner.png","02-evidence-and-edits.png","03-page-tint.png"]
    }, null, 2)+"\n");
    await context.close();
  } finally { await browser.close(); }
}

await copyFile(path.join(root,"extension/icons/icon-128.png"),path.join(output,"extension-icon-128.png"));
// Use the existing code-native monogram geometry from generate-icons.py.
function icon(size, opaque) {
  const channels=opaque?3:4, rows=Buffer.alloc((size*channels+1)*size);
  const distance=(x,y,ax,ay,bx,by)=>{const t=Math.max(0,Math.min(1,((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)));return Math.hypot(x-ax-t*(bx-ax),y-ay-t*(by-ay));};
  const lines=[[25,40,39,88],[39,88,54,49],[54,49,70,88],[70,88,85,40]];
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const sum=[0,0,0,0];
    for(const[ox,oy]of [[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){
      const x=(i+ox)*128/size,y=(j+oy)*128/size,cx=Math.max(27,Math.min(101,x)),cy=Math.max(27,Math.min(101,y));
      let color=(x-cx)**2+(y-cy)**2<=23**2?[32,52,76,255]:[0,0,0,0];
      if(color[3]&&lines.some(line=>distance(x,y,...line)<3.6))color=[250,247,238,255];
      if((x-97)**2+(y-31)**2<8**2)color=[205,161,78,255];
      for(let c=0;c<4;c++)sum[c]+=color[c];
    }
    const rgba=sum.map(value=>Math.round(value/4)),offset=j*(size*channels+1)+1+i*channels;
    for(let c=0;c<channels;c++)rows[offset+c]=opaque?Math.round(rgba[c]*rgba[3]/255+255-rgba[3]):rgba[c];
  }
  return png(size,size,channels,rows);
}
await writeFile(path.join(output,"edge-logo-300.png"),icon(300,false));
await writeFile(path.join(output,"safari-app-icon-1024.png"),icon(1024,true));
console.log("Prepared existing 128px extension icon, 300px Edge logo and opaque 1024px Safari app icon.");
