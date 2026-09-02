import { chmod, mkdir, mkdtemp, readFile, rm, unlink } from "node:fs/promises";
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

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const tarball = path.resolve("artifacts", `repomemo-${packageJson.version}.tgz`);
const installSh = path.resolve("install.sh");
const installCnSh = path.resolve("install-cn.sh");
const installPs1 = path.resolve("install.ps1");
const installCnPs1 = path.resolve("install-cn.ps1");
const temporary = await mkdtemp(path.join(os.tmpdir(), "repomemo-installer-smoke-"));

async function verifyInstalled(wrapper, project, shell) {
  const options = shell ? { shell: true, windowsHide: true } : {};
  const version = run(wrapper, ["--version"], options);
  if (version !== `repomemo ${packageJson.version}`) throw new Error(`installer reported an unexpected version: ${version}`);
  await mkdir(project, { recursive: true });
  run(wrapper, ["init", "--target", project], options);
  await unlink(path.join(project, "CLAUDE.md"));
  const repair = JSON.parse(run(wrapper, ["repair", "--target", project, "--harness", "claude", "--json"], options));
  if (!repair.changed || !repair.healthy) throw new Error("installed repair command did not restore a healthy contract");
  const doctor = JSON.parse(run(wrapper, ["doctor", "--target", project, "--json"], options));
  if (!doctor.healthy) throw new Error("installed doctor command did not report a healthy contract");
}

async function smoke(name, script, china) {
  const root = path.join(temporary, name);
  const installRoot = path.join(root, "runtime and app");
  const binDir = path.join(root, "bin");
  const profileHome = path.join(root, "profile home");
  await mkdir(profileHome, { recursive: true });
  const env = {
    ...process.env,
    REPOMEMO_INSTALL_ROOT: installRoot,
    REPOMEMO_BIN_DIR: binDir,
    REPOMEMO_PACKAGE_SPEC: tarball,
    REPOMEMO_SKIP_PATH_UPDATE: china || process.platform === "win32" ? "1" : "0",
    REPOMEMO_PROFILE_HOME: profileHome,
    REPOMEMO_INSTALLER_SOURCE: process.platform === "win32" ? installPs1 : installSh
  };

  let output;
  if (process.platform === "win32") {
    output = run("pwsh", ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], { env });
    run("pwsh", ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], { env });
    await verifyInstalled(path.join(binDir, "repomemo.cmd"), path.join(root, "project"), true);
  } else {
    run("sh", ["-n", script]);
    output = run("sh", [script], { env });
    run("sh", [script], { env });
    await chmod(path.join(binDir, "repomemo"), 0o755);
    await verifyInstalled(path.join(binDir, "repomemo"), path.join(root, "project"), false);
  }

  if (!china && process.platform !== "win32") {
    const profile = await readFile(path.join(profileHome, ".profile"), "utf8");
    if (!profile.includes(`export PATH="${binDir}:$PATH"`)) throw new Error("installer did not persist a literal PATH fallback");
    if (profile.split(binDir).length - 1 !== 1) throw new Error("reinstall duplicated the persisted PATH entry");
  }
  if (china && !output.includes("Using China mirrors")) throw new Error("China installer did not enable the mirror mode");
}

try {
  const posixSource = await readFile(installSh, "utf8");
  const powershellSource = await readFile(installPs1, "utf8");
  for (const source of [posixSource, powershellSource]) {
    if (!source.includes("SHASUMS256.txt") || !source.includes("registry.npmmirror.com") || !source.includes("v24")) {
      throw new Error("installer is missing checksum verification or China mirror configuration");
    }
  }

  if (process.platform === "win32") {
    await smoke("global", installPs1, false);
    await smoke("china", installCnPs1, true);
  } else {
    await smoke("global", installSh, false);
    await smoke("china", installCnSh, true);
  }
  process.stdout.write(`installer smoke passed on ${process.platform}\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
