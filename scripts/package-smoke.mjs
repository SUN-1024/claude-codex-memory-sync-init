import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  return result;
}

let tarball = process.argv[2];
if (!tarball) {
  const candidates = (await readdir("artifacts")).filter((name) => name.endsWith(".tgz"));
  if (candidates.length !== 1) throw new Error("pass exactly one package tarball or place one .tgz in artifacts/");
  tarball = path.resolve("artifacts", candidates[0]);
} else tarball = path.resolve(tarball);

const packageManager = process.env.npm_execpath;
if (!packageManager) throw new Error("package smoke must run through pnpm");
const temporary = await mkdtemp(path.join(os.tmpdir(), "repomemo-package-"));
try {
  await writeFile(path.join(temporary, "package.json"), "{\"private\":true}\n", "utf8");
  run(process.execPath, [packageManager, "add", "--dir", temporary, "--ignore-scripts", tarball]);
  const cli = path.join(temporary, "node_modules", "repomemo", "dist", "cli.js");
  const version = run(process.execPath, [packageManager, "--dir", temporary, "exec", "repomemo", "--version"]);
  if (!version.stdout.includes("repomemo 2.0.0")) throw new Error("installed package reported the wrong version");
  const project = path.join(temporary, "project with spaces");
  await mkdir(project);
  run(process.execPath, [cli, "init", "--target", project]);
  const doctor = run(process.execPath, [cli, "doctor", "--target", project, "--json"]);
  const report = JSON.parse(doctor.stdout);
  if (!report.healthy) throw new Error("installed package doctor did not pass");
  const agents = await readFile(path.join(project, "AGENTS.md"), "utf8");
  if (!agents.includes("repomemo:start")) throw new Error("installed package did not initialize AGENTS.md");
  process.stdout.write(`package smoke passed: ${tarball}\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
