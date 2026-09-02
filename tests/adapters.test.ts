import assert from "node:assert/strict";
import test from "node:test";
import { getAdapter, getAdapters } from "../src/adapters.js";
import { DEPRECATED_LINK_SPECS, LINK_SPECS } from "../src/constants.js";

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
  assert.deepEqual(getAdapter("codex")?.skills, { mode: "native", path: ".agents/skills" });
  assert.deepEqual(getAdapter("opencode")?.skills, { mode: "native", path: ".agents/skills" });
  assert.deepEqual(getAdapter("opencode")?.bridges, []);
  assert.deepEqual(LINK_SPECS, [{ harness: "claude", link: ".claude/skills", target: ".agents/skills" }]);
  assert.deepEqual(DEPRECATED_LINK_SPECS, [{ harness: "zcode", link: ".zcode/skills", target: ".agents/skills" }]);
});

test("adapter registry callers receive defensive clones", () => {
  const adapter = getAdapter("codex");
  assert.ok(adapter);
  adapter.name = "mutated";
  assert.equal(getAdapter("codex")?.name, "Codex");
  assert.equal(getAdapter("missing"), undefined);
});
