import assert from "node:assert/strict";
import { mkdir, mkdtemp, readlink, readdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { stageLinkRemovals, type LinkSpec } from "../src/links.js";

const spec: LinkSpec = {
  harness: "claude",
  consumers: ["claude", "opencode", "cursor", "copilot"],
  link: ".claude/skills",
  target: ".agents/skills"
};

async function linkedFixture(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "repomemo-link-transaction-"));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  await mkdir(path.join(root, ".agents", "skills"), { recursive: true });
  await mkdir(path.join(root, ".claude"));
  await symlink(path.join(root, ".agents", "skills"), path.join(root, ".claude", "skills"), process.platform === "win32" ? "junction" : "dir");
  return root;
}

test("deprecated-link staging can roll back without changing the original alias", async (t) => {
  const root = await linkedFixture(t);
  const original = await readlink(path.join(root, ".claude", "skills"));
  const transaction = await stageLinkRemovals(root, [spec]);
  await assert.rejects(readlink(path.join(root, ".claude", "skills")));
  await transaction.rollback();
  assert.equal(await readlink(path.join(root, ".claude", "skills")), original);
});

test("deprecated-link commit removes both discovery path and hidden staging alias", async (t) => {
  const root = await linkedFixture(t);
  const transaction = await stageLinkRemovals(root, [spec]);
  assert.deepEqual(await transaction.commit(), []);
  await assert.rejects(readlink(path.join(root, ".claude", "skills")));
  assert.ok(!(await readdir(path.join(root, ".claude"))).some((name) => name.includes("repomemo-remove")));
});
