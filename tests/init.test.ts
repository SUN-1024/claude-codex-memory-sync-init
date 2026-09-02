import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runInit } from "../src/init.js";

test("init never creates duplicate Harness Skill aliases", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "repomemo-link-fallback-"));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  const target = path.join(root, "project");
  await mkdir(target);

  let createCalls = 0;
  const result = await runInit(target, false, { createLink: async () => { createCalls += 1; } });

  assert.equal(createCalls, 0);
  assert.equal(result.findings.length, 0);
  assert.equal(result.changes.some((change) => change.startsWith("LINK ")), false);
  assert.match(await readFile(path.join(target, "AGENTS.md"), "utf8"), /repomemo:start/u);
  await assert.rejects(readlink(path.join(target, ".claude", "skills")));
  await assert.rejects(readlink(path.join(target, ".zcode", "skills")));
});
