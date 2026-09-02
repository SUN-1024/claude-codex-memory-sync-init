import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { atomicWriteBatch, withProjectInitLock } from "../src/path-utils.js";

test("multi-file writes stage all content before replacing any destination", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "repomemo-write-batch-"));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  const first = path.join(root, "first.md");
  const impossibleParent = path.join(root, "not-a-directory");
  await writeFile(first, "original\n", "utf8");
  await writeFile(impossibleParent, "file\n", "utf8");

  await assert.rejects(atomicWriteBatch([
    { filePath: first, content: "replacement\n" },
    { filePath: path.join(impossibleParent, "second.md"), content: "new\n" }
  ]));

  assert.equal(await readFile(first, "utf8"), "original\n");
  assert.ok(!(await readdir(root)).some((name) => name.includes("repomemo-") && name.endsWith(".tmp")));
});

test("init locking recovers an old lock with missing owner metadata", async (t) => {
  const target = await mkdtemp(path.join(os.tmpdir(), "repomemo-stale-lock-target-"));
  const digest = createHash("sha256").update(target).digest("hex").slice(0, 24);
  const lockPath = path.join(os.tmpdir(), `repomemo-init-${digest}.lock`);
  t.after(async () => {
    await rm(target, { recursive: true, force: true });
    await rm(lockPath, { force: true });
  });
  await writeFile(lockPath, "", { mode: 0o600 });
  const old = new Date(Date.now() - 10_000);
  await utimes(lockPath, old, old);

  let entered = false;
  await withProjectInitLock(target, async () => { entered = true; });
  assert.equal(entered, true);
  await assert.rejects(readFile(lockPath, "utf8"));
});

test("init locking never steals an old lock from a live owner", async (t) => {
  const target = await mkdtemp(path.join(os.tmpdir(), "repomemo-live-lock-target-"));
  const digest = createHash("sha256").update(target).digest("hex").slice(0, 24);
  const lockPath = path.join(os.tmpdir(), `repomemo-init-${digest}.lock`);
  t.after(async () => {
    await rm(target, { recursive: true, force: true });
    await rm(lockPath, { force: true });
  });
  await writeFile(lockPath, `${JSON.stringify({ pid: process.pid, token: "live-owner", createdAt: Date.now() - 301_000 })}\n`, { mode: 0o600 });

  let entered = false;
  const waiting = withProjectInitLock(target, async () => { entered = true; });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(entered, false);
  await rm(lockPath, { force: true });
  await waiting;
  assert.equal(entered, true);
});

test("concurrent stale-lock cleaners still serialize writers", async (t) => {
  const target = await mkdtemp(path.join(os.tmpdir(), "repomemo-stale-cleaner-target-"));
  const digest = createHash("sha256").update(target).digest("hex").slice(0, 24);
  const lockPath = path.join(os.tmpdir(), `repomemo-init-${digest}.lock`);
  t.after(async () => {
    await rm(target, { recursive: true, force: true });
    await rm(lockPath, { force: true });
  });
  await writeFile(lockPath, `${JSON.stringify({ pid: 999_999_999, token: "dead-owner", createdAt: Date.now() - 301_000 })}\n`, { mode: 0o600 });

  let active = 0;
  let maximumActive = 0;
  const writer = () => withProjectInitLock(target, async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 75));
    active -= 1;
  });
  await Promise.all([writer(), writer()]);
  assert.equal(maximumActive, 1);
});
