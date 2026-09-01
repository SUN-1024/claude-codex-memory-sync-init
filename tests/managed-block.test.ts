import assert from "node:assert/strict";
import test from "node:test";
import { applyManagedBlock, inspectManagedBlock } from "../src/managed-block.js";

const markers = { start: "<!-- start -->", end: "<!-- end -->" };
const block = "<!-- start -->\nnew\n<!-- end -->";

test("managed blocks append without replacing user content", () => {
  const result = applyManagedBlock("# User\n", block, markers);
  assert.equal(result.kind, "updated");
  assert.match(result.content, /^# User\n\n<!-- start -->/u);
});

test("managed blocks preserve CRLF and are idempotent", () => {
  const first = applyManagedBlock("# User\r\n", block, markers);
  assert.match(first.content, /\r\n/u);
  assert.doesNotMatch(first.content, /(?<!\r)\n/u);
  const second = applyManagedBlock(first.content, block, markers);
  assert.equal(second.kind, "unchanged");
  assert.equal(second.content, first.content);
});

test("malformed and duplicate markers fail closed", () => {
  assert.equal(inspectManagedBlock("<!-- start -->\nbody", markers).kind, "malformed");
  assert.equal(inspectManagedBlock("<!-- start --><!-- start --><!-- end -->", markers).kind, "malformed");
  assert.equal(
    inspectManagedBlock(
      "<!-- repomemo:start -->\n<!-- repomemo:bridge:claude:start -->\n<!-- repomemo:end -->",
      { start: "<!-- repomemo:start -->", end: "<!-- repomemo:end -->" }
    ).kind,
    "malformed"
  );
});

test("equivalent unmanaged bridge remains untouched", () => {
  const result = applyManagedBlock("@AGENTS.md\n", block, markers, (content) => content.includes("@AGENTS.md"));
  assert.equal(result.kind, "unchanged");
  assert.equal(result.managed, false);
});
