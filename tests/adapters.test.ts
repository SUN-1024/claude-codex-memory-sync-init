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
  assert.deepEqual(getAdapter("claude")?.skills, {
    mode: "manual",
    path: ".agents/skills",
    mechanism: "AGENTS.md instruction imported through CLAUDE.md; alias omitted to prevent duplicate discovery in multi-path Harnesses"
  });
  assert.deepEqual(getAdapter("opencode")?.skills, {
    mode: "manual",
    path: ".agents/skills",
    mechanism: "AGENTS.md instruction; tested 1.17.7 did not catalog the project path without a duplicate compatibility alias"
  });
  assert.deepEqual(getAdapter("opencode")?.bridges, []);
  assert.equal(getAdapter("gemini")?.evidence.minimumVersion, "0.26.0");
  assert.deepEqual(LINK_SPECS, []);
  assert.deepEqual(DEPRECATED_LINK_SPECS, [
    { harness: "claude", consumers: ["claude", "opencode", "cursor", "copilot"], link: ".claude/skills", target: ".agents/skills" },
    { harness: "zcode", consumers: ["zcode"], link: ".zcode/skills", target: ".agents/skills" }
  ]);
});

test("adapter registry callers receive defensive clones", () => {
  const adapter = getAdapter("codex");
  assert.ok(adapter);
  adapter.name = "mutated";
  assert.equal(getAdapter("codex")?.name, "Codex");
  assert.equal(getAdapter("missing"), undefined);
});
