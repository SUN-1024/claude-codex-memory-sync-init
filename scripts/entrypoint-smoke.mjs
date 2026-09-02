import { copyFile, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.error?.stack ?? ""}${result.stdout ?? ""}${result.stderr ?? ""}`);
  }
  return result.stdout.trim();
}

const expectedVersion = JSON.parse(await readFile("package.json", "utf8")).version;
const expectedName = `repomemo-${expectedVersion}.tgz`;
const candidates = await readdir("artifacts");
if (!candidates.includes(expectedName)) throw new Error(`entrypoint smoke requires artifacts/${expectedName}`);
const tarball = path.resolve("artifacts", expectedName);
const expectedOutput = `repomemo ${expectedVersion}`;
const packageManager = process.env.npm_execpath;
if (!packageManager) throw new Error("entrypoint smoke must run through pnpm");

const temporary = await mkdtemp(path.join(os.tmpdir(), "repomemo-entrypoint-"));
try {
  const uniqueTarball = path.join(temporary, `${Date.now()}-${expectedName}`);
  await copyFile(tarball, uniqueTarball);
  const pnpmOutput = run(process.execPath, [packageManager, "dlx", uniqueTarball, "--version"]);
  if (!pnpmOutput.endsWith(expectedOutput)) throw new Error(`pnpm dlx reported an unexpected version: ${pnpmOutput}`);
  run(process.execPath, [packageManager, "dlx", uniqueTarball, "repair", "--help"]);

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const npxOptions = process.platform === "win32" ? { shell: true, windowsHide: true } : {};
  const npxOutput = run(npx, ["--yes", "--package", uniqueTarball, "repomemo", "--version"], npxOptions);
  if (npxOutput !== expectedOutput) throw new Error(`npx reported an unexpected version: ${npxOutput}`);
  run(npx, ["--yes", "--package", uniqueTarball, "repomemo", "repair", "--help"], npxOptions);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

process.stdout.write(`entrypoint smoke passed: ${expectedName}\n`);
