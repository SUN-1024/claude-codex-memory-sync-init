import rawAdapters from "../data/harnesses.json" with { type: "json" };
import { isProjectRelative } from "./path-utils.js";
import type { CompatibilityMode, EvidenceLevel, HarnessAdapter } from "./types.js";

const MODES = new Set<CompatibilityMode>(["native", "bridge", "manual", "unsupported"]);
const EVIDENCE = new Set<EvidenceLevel>(["official-smoke", "official", "source-verified", "provisional"]);

function validateAdapter(value: unknown): HarnessAdapter {
  if (!value || typeof value !== "object") throw new Error("invalid harness adapter: expected object");
  const item = value as Record<string, unknown>;
  const rules = item.rules as Record<string, unknown> | undefined;
  const skills = item.skills as Record<string, unknown> | undefined;
  const evidence = item.evidence as Record<string, unknown> | undefined;
  const detection = item.detection as Record<string, unknown> | undefined;
  if (typeof item.id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/u.test(item.id)) throw new Error("invalid harness adapter id");
  if (typeof item.name !== "string" || !Array.isArray(item.platforms) || !Array.isArray(item.bridges)) throw new Error(`invalid harness adapter metadata: ${item.id}`);
  if (!item.platforms.every((platform) => ["darwin", "linux", "win32"].includes(String(platform)))) throw new Error(`invalid harness platform: ${item.id}`);
  if (!item.bridges.every((bridge) => typeof bridge === "string" && isProjectRelative(bridge))) throw new Error(`invalid harness bridge path: ${item.id}`);
  if (!detection || !Array.isArray(detection.commands) || !Array.isArray(detection.projectMarkers)) throw new Error(`invalid harness detection hints: ${item.id}`);
  if (!detection.commands.every((command) => typeof command === "string" && /^[a-zA-Z0-9._-]+$/u.test(command))) throw new Error(`invalid harness command hint: ${item.id}`);
  if (!detection.projectMarkers.every((marker) => typeof marker === "string" && isProjectRelative(marker))) throw new Error(`invalid harness marker hint: ${item.id}`);
  if (!rules || !MODES.has(rules.mode as CompatibilityMode) || !skills || !MODES.has(skills.mode as CompatibilityMode)) throw new Error(`invalid harness compatibility mode: ${item.id}`);
  for (const endpoint of [rules, skills]) {
    if (endpoint.path !== undefined && (typeof endpoint.path !== "string" || !isProjectRelative(endpoint.path))) throw new Error(`invalid harness endpoint path: ${item.id}`);
    if (endpoint.mechanism !== undefined && typeof endpoint.mechanism !== "string") throw new Error(`invalid harness mechanism: ${item.id}`);
  }
  if (
    !evidence
    || !EVIDENCE.has(evidence.level as EvidenceLevel)
    || !Array.isArray(evidence.docs)
    || !evidence.docs.every((document) => typeof document === "string" && document.startsWith("https://"))
    || typeof evidence.verifiedDate !== "string"
    || !/^\d{4}-\d{2}-\d{2}$/u.test(evidence.verifiedDate)
  ) throw new Error(`invalid harness evidence: ${item.id}`);
  if (evidence.level === "official-smoke" && typeof evidence.verifiedVersion !== "string") throw new Error(`smoke-tested harness needs a version: ${item.id}`);
  return value as HarnessAdapter;
}

const adapters = (rawAdapters as unknown[]).map(validateAdapter);
const ids = new Set<string>();
for (const adapter of adapters) {
  if (ids.has(adapter.id)) throw new Error(`duplicate harness adapter id: ${adapter.id}`);
  ids.add(adapter.id);
}

export function getAdapters(): HarnessAdapter[] {
  return adapters.map((adapter) => structuredClone(adapter));
}

export function getAdapter(id: string): HarnessAdapter | undefined {
  const adapter = adapters.find((candidate) => candidate.id === id);
  return adapter ? structuredClone(adapter) : undefined;
}

export function hasAdapter(id: string): boolean {
  return ids.has(id);
}
