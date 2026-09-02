import { chmod, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const adapters = JSON.parse(await readFile(new URL("../data/harnesses.json", import.meta.url), "utf8"));
const start = "<!-- repomemo:matrix:start -->";
const end = "<!-- repomemo:matrix:end -->";
const cell = (value) => String(value).replaceAll("|", "\\|").replace(/\r?\n/gu, "<br>");
const boundary = (adapter) => {
  const tested = adapter.evidence.verifiedVersion ? `tested ${adapter.evidence.verifiedVersion}` : "docs only";
  return adapter.evidence.minimumVersion ? `${tested}; requires >=${adapter.evidence.minimumVersion}` : tested;
};
const header = "| Harness | Rules | Skills | Evidence | Version boundary |\n|---|---|---|---|---|";
const rows = adapters.map((adapter) => `| ${cell(adapter.name)} | ${cell(adapter.rules.mode)} | ${cell(adapter.skills.mode)} | ${cell(adapter.evidence.level)} | ${cell(boundary(adapter))} |`).join("\n");
const block = `${start}\n${header}\n${rows}\n${end}`;
const check = process.argv.includes("--check");

const plans = [];
for (const file of ["README.md", "README.zh.md"]) {
  const content = await readFile(file, "utf8");
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const localizedBlock = block.replaceAll("\n", eol);
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end);
  const starts = content.split(start).length - 1;
  const ends = content.split(end).length - 1;
  if (starts !== 1 || ends !== 1 || startIndex === -1 || endIndex < startIndex) {
    throw new Error(`${file} has ambiguous matrix markers (${starts}/${ends}); refusing to modify either README`);
  }
  const next = `${content.slice(0, startIndex)}${localizedBlock}${content.slice(endIndex + end.length)}`;
  if (check && next !== content) {
    process.stderr.write(`${file}: support matrix is out of date\n`);
    process.exitCode = 1;
  } else if (!check && next !== content) plans.push({ file, next });
}

if (!check && plans.length > 0) {
  const token = `repomemo-matrix-${process.pid}-${randomUUID()}`;
  const staged = [];
  try {
    for (const plan of plans) {
      const temporary = `.${plan.file}.${token}.tmp`;
      const backup = `.${plan.file}.${token}.bak`;
      const details = await stat(plan.file);
      await writeFile(temporary, plan.next, "utf8");
      await chmod(temporary, details.mode);
      staged.push({ ...plan, temporary, backup, backupCreated: false, committed: false });
    }
    for (const plan of staged) {
      await rename(plan.file, plan.backup);
      plan.backupCreated = true;
      await rename(plan.temporary, plan.file);
      plan.committed = true;
    }
    for (const plan of staged) if (plan.backupCreated) await unlink(plan.backup).catch(() => undefined);
  } catch (error) {
    const rollbackErrors = [];
    for (const plan of [...staged].reverse()) {
      try {
        if (plan.committed) await unlink(plan.file);
        if (plan.backupCreated) await rename(plan.backup, plan.file);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
      }
      await unlink(plan.temporary).catch(() => undefined);
    }
    if (rollbackErrors.length > 0) throw new Error(`${error instanceof Error ? error.message : String(error)}; matrix rollback also failed: ${rollbackErrors.join("; ")}`);
    throw error;
  }
}
