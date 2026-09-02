import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runInit } from "../src/init.js";

test("link creation failure becomes an honest manual fallback", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "repomemo-link-fallback-"));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  const target = path.join(root, "project");
  await mkdir(target);

  const result = await runInit(target, false, {
    createLink: async () => { throw new Error("simulated link denial"); }
  });

  assert.equal(result.findings.filter((finding) => finding.code === "SKILLS_LINK_MANUAL_FALLBACK").length, 2);
  assert.deepEqual(
    result.findings.map((finding) => finding.harness),
    ["claude", "zcode"]
  );
  assert.ok(result.findings.every((finding) => finding.message.includes("manual AGENTS.md fallback")));
  assert.equal(result.changes.some((change) => change.startsWith("LINK ")), false);
  assert.match(await readFile(path.join(target, "AGENTS.md"), "utf8"), /repomemo:start/u);
  await assert.rejects(readlink(path.join(target, ".claude", "skills")));
  await assert.rejects(readlink(path.join(target, ".zcode", "skills")));
});
