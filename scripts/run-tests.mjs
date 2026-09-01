import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(candidate));
    else if (entry.name.endsWith(".test.ts")) files.push(candidate);
  }
  return files;
}

const outputDirectory = ".test-dist";
await rm(outputDirectory, { recursive: true, force: true });
const tests = await collect("tests");
if (tests.length === 0) throw new Error("no test files found");
await build({
  entryPoints: tests,
  outdir: outputDirectory,
  outbase: "tests",
  entryNames: "[dir]/[name]",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: "inline"
});
const outputs = tests.map((test) => path.join(outputDirectory, path.relative("tests", test).replace(/\.ts$/u, ".js")));
const result = spawnSync(process.execPath, ["--test", ...outputs], { stdio: "inherit" });
process.exit(result.status ?? 1);
