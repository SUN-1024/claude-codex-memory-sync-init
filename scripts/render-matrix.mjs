import { readFile, writeFile } from "node:fs/promises";

const adapters = JSON.parse(await readFile(new URL("../data/harnesses.json", import.meta.url), "utf8"));
const start = "<!-- repomemo:matrix:start -->";
const end = "<!-- repomemo:matrix:end -->";
const header = "| Harness | Rules | Skills | Evidence | Verified version |\n|---|---|---|---|---|";
const rows = adapters.map((adapter) => `| ${adapter.name} | ${adapter.rules.mode} | ${adapter.skills.mode} | ${adapter.evidence.level} | ${adapter.evidence.verifiedVersion ?? "docs only"} |`).join("\n");
const block = `${start}\n${header}\n${rows}\n${end}`;
const check = process.argv.includes("--check");

for (const file of ["README.md", "README.zh.md"]) {
  const content = await readFile(file, "utf8");
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const localizedBlock = block.replaceAll("\n", eol);
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end);
  if (startIndex === -1 || endIndex < startIndex) throw new Error(`${file} is missing matrix markers`);
  const next = `${content.slice(0, startIndex)}${localizedBlock}${content.slice(endIndex + end.length)}`;
  if (check && next !== content) {
    process.stderr.write(`${file}: support matrix is out of date\n`);
    process.exitCode = 1;
  } else if (!check && next !== content) await writeFile(file, next, "utf8");
}
