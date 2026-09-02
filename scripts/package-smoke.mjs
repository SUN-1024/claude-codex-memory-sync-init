import { mkdtemp, mkdir, readFile, realpath, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  return result;
}

const expectedVersion = JSON.parse(await readFile("package.json", "utf8")).version;
let tarball = process.argv[2];
if (!tarball) {
  const expectedName = `repomemo-${expectedVersion}.tgz`;
  const candidates = await readdir("artifacts");
  if (!candidates.includes(expectedName)) throw new Error(`pass a package tarball or place ${expectedName} in artifacts/`);
  tarball = path.resolve("artifacts", expectedName);
} else tarball = path.resolve(tarball);

const packageManager = process.env.npm_execpath;
if (!packageManager) throw new Error("package smoke must run through pnpm");
const temporary = await mkdtemp(path.join(os.tmpdir(), "repomemo-package-"));
try {
  await writeFile(path.join(temporary, "package.json"), "{\"private\":true}\n", "utf8");
  run(process.execPath, [packageManager, "add", "--dir", temporary, "--ignore-scripts", tarball]);
  const cli = path.join(temporary, "node_modules", "repomemo", "dist", "cli.js");
  const version = run(process.execPath, [packageManager, "--dir", temporary, "exec", "repomemo", "--version"]);
  if (version.stdout.trim() !== `repomemo ${expectedVersion}`) throw new Error("installed package reported the wrong version");
  const project = path.join(temporary, "project with spaces");
  await mkdir(project);
  run(process.execPath, [cli, "init", "--target", project]);
  const doctor = run(process.execPath, [cli, "doctor", "--target", project, "--json"]);
  const report = JSON.parse(doctor.stdout);
  if (!report.healthy) throw new Error("installed package doctor did not pass");
  await unlink(path.join(project, ".claude", "skills"));
  const repair = run(process.execPath, [cli, "repair", "--target", project, "--harness", "claude", "--json"]);
  if (!JSON.parse(repair.stdout).changed) throw new Error("installed package repair did not report a change");
  const linkPath = path.join(project, ".claude", "skills");
  if (await realpath(linkPath) !== await realpath(path.join(project, ".agents", "skills"))) {
    throw new Error("installed package repair did not restore the canonical skills link");
  }
  const agents = await readFile(path.join(project, "AGENTS.md"), "utf8");
  if (!agents.includes("repomemo:start")) throw new Error("installed package did not initialize AGENTS.md");
  process.stdout.write(`package smoke passed: ${tarball}\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
