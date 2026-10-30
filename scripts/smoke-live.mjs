import { scanArticle } from "../extension/scanner.js";

const title = process.argv.slice(2).find(argument => !argument.startsWith("--")) || "BP";
const result = await scanArticle(title, { deep: process.argv.includes("--deep") });
console.log(JSON.stringify({
  title: result.title, complete: result.complete, checkedAt: result.checkedAt,
  evidence: result.evidence.map(({ kind, contributor, employer, sourceUrl }) => ({ kind, contributor, employer, sourceUrl })),
  coverage: result.coverage, warnings: result.warnings
}, null, 2));
