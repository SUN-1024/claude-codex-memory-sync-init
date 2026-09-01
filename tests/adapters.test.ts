import assert from "node:assert/strict";
import test from "node:test";
import { getAdapter, getAdapters } from "../src/adapters.js";

test("adapter registry exposes the fixed v2 launch set", () => {
  const adapters = getAdapters();
  assert.deepEqual(
    adapters.map((adapter) => adapter.id),
    ["codex", "claude", "gemini", "opencode", "cursor", "copilot", "zcode", "dsh"]
  );
  for (const adapter of adapters) {
    assert.ok(adapter.detection.commands.length > 0);
    assert.ok(adapter.evidence.docs.length > 0);
    assert.match(adapter.evidence.verifiedDate, /^\d{4}-\d{2}-\d{2}$/u);
    if (adapter.evidence.level === "official-smoke") assert.ok(adapter.evidence.verifiedVersion);
  }
});

test("adapter registry callers receive defensive clones", () => {
  const adapter = getAdapter("codex");
  assert.ok(adapter);
  adapter.name = "mutated";
  assert.equal(getAdapter("codex")?.name, "Codex");
  assert.equal(getAdapter("missing"), undefined);
});
