import { readFile, access, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = path.join(root, "extension");
const manifest = JSON.parse(await readFile(path.join(extension, "manifest.json"), "utf8"));
const files = [manifest.background.service_worker, ...manifest.content_scripts.flatMap(s => s.js), ...Object.values(manifest.icons)];
for (const file of files) await access(path.join(extension, file));
for (const entry of await readdir(extension)) if (entry.endsWith(".js")) execFileSync(process.execPath, ["--check", path.join(extension, entry)]);
if (JSON.stringify(manifest.host_permissions) !== '["https://en.wikipedia.org/*"]') throw new Error("Unexpected website permission.");
if (JSON.stringify(manifest.permissions) !== '["storage"]') throw new Error("Unexpected extension permission.");
console.log(`Manifest references and JavaScript syntax verified for Wikipaidia ${manifest.version}.`);
