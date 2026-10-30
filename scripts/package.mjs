import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "extension");
const { version } = JSON.parse(await readFile(path.join(source, "manifest.json"), "utf8"));
const files = [];
async function walk(dir, prefix = "") {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix + entry.name;
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), `${name}/`);
    else if (entry.isFile()) files.push([name, await readFile(path.join(dir, entry.name))]);
  }
}
await walk(source);
// Distribute the project's license notice with every downloadable package.
files.push(["LICENSE", await readFile(path.join(root, "LICENSE"))]);
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const local = [], central = [];
let offset = 0;
for (const [name, content] of files) {
  const filename = Buffer.from(name);
  const checksum = crc32(content);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(0x21, 12); header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(content.length, 18); header.writeUInt32LE(content.length, 22); header.writeUInt16LE(filename.length, 26);
  local.push(header, filename, content);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x800, 8);
  entry.writeUInt16LE(0x21, 14); entry.writeUInt32LE(checksum, 16); entry.writeUInt32LE(content.length, 20); entry.writeUInt32LE(content.length, 24);
  entry.writeUInt16LE(filename.length, 28); entry.writeUInt32LE(offset, 42);
  central.push(entry, filename);
  offset += header.length + filename.length + content.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
await mkdir(path.join(root, "dist"), { recursive: true });
// All three browsers use the same Manifest V3 source. Keep the existing Safari
// filename and provide explicit packages for Chrome and Edge installations.
const archive = Buffer.concat([...local, directory, end]);
for (const browser of ["Chrome", "Edge", "Safari"]) {
  const output = path.join(root, "dist", `Wikipaidia-${browser}-${version}.zip`);
  await writeFile(output, archive);
  console.log(`Packaged ${files.length} files for ${browser}: ${output}`);
}
