import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { atomicWriteBatch } from "../src/path-utils.js";

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
