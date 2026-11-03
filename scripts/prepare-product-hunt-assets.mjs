// Format existing, labeled product screenshots for Product Hunt. No live sites,
// user profiles, Wikipedia requests, or extension runtime changes are involved.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "store-submissions/product-hunt/assets");
const inputs = [
  ["store-submissions/assets/safari-app-icon-1024.png", "logo-240.png", 240, 240, "#ffffff"],
  ["store-submissions/assets/chromium/02-evidence-and-edits.png", "01-evidence-and-edits.png", 1270, 760, "#20344c"],
  ["store-submissions/assets/chromium/01-banner.png", "02-banner.png", 1270, 760, "#20344c"],
  ["store-submissions/assets/chromium/03-page-tint.png", "03-page-tint.png", 1270, 760, "#20344c"]
];
await mkdir(output, { recursive: true });
const channel = process.env.PRODUCT_HUNT_BROWSER_CHANNEL || "chromium";
assert.ok(["chromium", "chrome", "msedge"].includes(channel), "Choose chromium, chrome, or msedge.");
const browser = await chromium.launch({ channel, headless: true });
const browserVersion = browser.version();
const manifest = JSON.parse(await readFile(path.join(root, "extension/manifest.json"), "utf8"));
const records = [];
try {
  const context = await browser.newContext({ deviceScaleFactor: 1, colorScheme: "light" });
  await context.route("**/*", route => route.abort());
  const page = await context.newPage();
  for (const [source, name, width, height, background] of inputs) {
    const bytes = await readFile(path.join(root, source));
    await page.setViewportSize({ width, height });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${background}}
      img{display:block;width:100%;height:100%;object-fit:contain}
      </style></head><body><img alt="Wikipaidia product asset" src="data:image/png;base64,${bytes.toString("base64")}"></body></html>`);
    await page.locator("img").evaluate(img => img.decode());
    const image = await page.screenshot({ type: "png", animations: "disabled" });
    assert.equal(image.readUInt32BE(16), width);
    assert.equal(image.readUInt32BE(20), height);
    assert.ok(image.length < 2 * 1024 * 1024, "Asset must fit Product Hunt's 2MB logo limit.");
    await writeFile(path.join(output, name), image);
    records.push({ file: name, width, height, bytes: image.length, source,
      sourceSHA256: createHash("sha256").update(bytes).digest("hex"),
      sha256: createHash("sha256").update(image).digest("hex") });
    console.log(`Prepared ${name}: ${width}×${height}, ${image.length} bytes`);
  }
  await context.close();
} finally {
  await browser.close();
}
await writeFile(path.join(output, "assets.json"), JSON.stringify({
  extensionVersion: manifest.version, fictionalExampleData: true,
  formattingBrowser: { channel, version: browserVersion },
  transform: "Existing assets scaled proportionally and centered; no screenshot content cropped or retouched.",
  assets: records
}, null, 2) + "\n");
