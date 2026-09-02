import { readdir } from "node:fs/promises";
import path from "node:path";
import { getAdapter, getAdapters } from "./adapters.js";
import {
  AGENTS_BLOCK, AGENTS_END, AGENTS_START,
  CLAUDE_BLOCK, CLAUDE_END, CLAUDE_START,
  GEMINI_BLOCK, GEMINI_END, GEMINI_START,
  LINK_SPECS, VERSION
} from "./constants.js";
import { createLink, inspectLink } from "./links.js";
import { applyManagedBlock, hasAgentsImport, inspectManagedBlock } from "./managed-block.js";
import { atomicWrite, pathKind, readText } from "./path-utils.js";
import { validateState } from "./state.js";
import type { DoctorReport, Finding, HarnessAdapter } from "./types.js";

interface DoctorOptions {
  harness?: string;
  repair: boolean;
}

function item(code: string, severity: Finding["severity"], message: string, repairable: boolean, filePath?: string, harness?: string): Finding {
  return {
    code, severity, message, repairable,
    ...(filePath ? { path: filePath } : {}),
    ...(harness ? { harness } : {})
  };
}

function selectedAdapters(harness: string | undefined): HarnessAdapter[] {
  if (!harness) return getAdapters();
  const adapter = getAdapter(harness);
  return adapter ? [adapter] : [];
}

function bridgeEnabled(harness: string | undefined, bridgeHarness: string): boolean {
  return !harness || harness === bridgeHarness;
}

async function repairManagedFile(
  target: string,
  relativePath: string,
  block: string,
  start: string,
  end: string,
  createWhenMissing: boolean,
  equivalent?: (content: string) => boolean
): Promise<boolean> {
  const filePath = path.join(target, relativePath);
  const kind = await pathKind(filePath);
  if (kind !== "missing" && kind !== "file") return false;
  const existing = await readText(filePath);
  if (existing === undefined && !createWhenMissing) return false;
  const applied = applyManagedBlock(existing, block, { start, end }, equivalent);
  if (applied.kind === "malformed" || applied.kind === "unchanged") return false;
  if (existing !== undefined && inspectManagedBlock(existing, { start, end }).kind === "absent" && !equivalent?.(existing)) return false;
  await atomicWrite(filePath, applied.content);
  return true;
}

async function repair(target: string, harness: string | undefined): Promise<string[]> {
  const changed: string[] = [];
  if (await repairManagedFile(target, "AGENTS.md", AGENTS_BLOCK, AGENTS_START, AGENTS_END, false)) changed.push("AGENTS.md");
  if (bridgeEnabled(harness, "claude") && await repairManagedFile(target, "CLAUDE.md", CLAUDE_BLOCK, CLAUDE_START, CLAUDE_END, true, hasAgentsImport)) changed.push("CLAUDE.md");
  if (bridgeEnabled(harness, "gemini") && await repairManagedFile(target, "GEMINI.md", GEMINI_BLOCK, GEMINI_START, GEMINI_END, true, hasAgentsImport)) changed.push("GEMINI.md");
  for (const spec of LINK_SPECS) {
    if (!bridgeEnabled(harness, spec.harness)) continue;
    const inspection = await inspectLink(target, spec);
    if (
      inspection.kind === "missing"
      && await pathKind(path.join(target, ".agents")) === "directory"
      && await pathKind(path.join(target, spec.target)) === "directory"
    ) {
      try {
        await createLink(target, spec);
        changed.push(spec.link);
      } catch {
        // Inspection below reports the manual fallback.
      }
    }
  }
  return changed;
}

async function inspectManaged(
  target: string,
  relativePath: string,
  canonical: string,
  start: string,
  end: string,
  findings: Finding[],
  options: { required: boolean; harness?: string; equivalent?: (content: string) => boolean }
): Promise<void> {
  const absolutePath = path.join(target, relativePath);
  const kind = await pathKind(absolutePath);
  if (kind !== "missing" && kind !== "file") {
    findings.push(item("MANAGED_FILE_CONFLICT", "error", `${relativePath} exists and is not a regular file.`, false, relativePath, options.harness));
    return;
  }
  const content = await readText(absolutePath);
  if (content === undefined) {
    if (options.required) findings.push(item("MANAGED_FILE_MISSING", "error", `${relativePath} is missing.`, relativePath !== "AGENTS.md", relativePath, options.harness));
    return;
  }
  const inspection = inspectManagedBlock(content, { start, end });
  if (inspection.kind === "malformed") {
    findings.push(item("MANAGED_BLOCK_MALFORMED", "error", `${relativePath}: ${inspection.reason}`, false, relativePath, options.harness));
    return;
  }
  if (inspection.kind === "absent") {
    if (options.equivalent?.(content)) findings.push(item("UNMANAGED_EQUIVALENT_BRIDGE", "info", `${relativePath} already imports AGENTS.md and remains user-managed.`, false, relativePath, options.harness));
    else findings.push(item("MANAGED_BLOCK_MISSING", "error", `${relativePath} does not contain the RepoMemo managed block.`, false, relativePath, options.harness));
    return;
  }
  const applied = applyManagedBlock(content, canonical, { start, end }, options.equivalent);
  if (applied.kind === "updated") findings.push(item("MANAGED_BLOCK_DRIFT", "error", `${relativePath} managed content differs from RepoMemo ${VERSION}.`, true, relativePath, options.harness));
}

async function inspectAncestors(target: string, findings: Finding[]): Promise<void> {
  let current = path.dirname(target);
  while (true) {
    for (const name of [".git", "AGENTS.md", "CLAUDE.md", "GEMINI.md"]) {
      if (await pathKind(path.join(current, name)) !== "missing") findings.push(item("AMBIENT_ANCESTOR_CONTEXT", "info", `Ancestor context may affect Harness root or instructions: ${path.join(current, name)}`, false));
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

async function hasGitContext(target: string): Promise<boolean> {
  let current = target;
  while (true) {
    if (await pathKind(path.join(current, ".git")) !== "missing") return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

async function inspectNestedAgents(target: string, findings: Finding[]): Promise<void> {
  const ignored = new Set([".git", "node_modules", "dist", ".test-dist"]);
  const queue = [target];
  while (queue.length > 0) {
    const directory = queue.pop();
    if (!directory) continue;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || ignored.has(entry.name)) continue;
      const child = path.join(directory, entry.name);
      if (await pathKind(path.join(child, "AGENTS.md")) === "file") findings.push(item("NESTED_AGENTS_HARNESS_DEPENDENT", "warning", `Nested AGENTS.md has Harness-specific semantics: ${path.relative(target, path.join(child, "AGENTS.md"))}`, false));
      queue.push(child);
    }
  }
}

async function inspectProject(target: string, harness: string | undefined): Promise<Finding[]> {
  const findings: Finding[] = [];
  await inspectManaged(target, "AGENTS.md", AGENTS_BLOCK, AGENTS_START, AGENTS_END, findings, { required: true });
  const statePath = path.join(target, "AGENT_STATE.md");
  const stateKind = await pathKind(statePath);
  if (stateKind === "missing") findings.push(item("STATE_MISSING", "error", "AGENT_STATE.md is missing.", false, "AGENT_STATE.md"));
  else if (stateKind !== "file") findings.push(item("STATE_FILE_CONFLICT", "error", "AGENT_STATE.md is not a regular file.", false, "AGENT_STATE.md"));
  else findings.push(...validateState((await readText(statePath)) ?? ""));

  const skillsParentKind = await pathKind(path.join(target, ".agents"));
  if (skillsParentKind !== "directory") findings.push(item("SKILLS_PARENT_CONFLICT", "error", ".agents must be a real directory inside the project.", false, ".agents"));
  const skillsKind = await pathKind(path.join(target, ".agents", "skills"));
  if (skillsKind !== "directory") findings.push(item("SKILLS_ROOT_MISSING", "error", ".agents/skills must be a real directory.", false, ".agents/skills"));
  else if (await pathKind(path.join(target, ".agents", "skills", "README.md")) === "missing") findings.push(item("SKILLS_README_MISSING", "info", ".agents/skills/README.md is optional but helps preserve the empty canonical directory.", false, ".agents/skills/README.md"));

  if (bridgeEnabled(harness, "claude")) await inspectManaged(target, "CLAUDE.md", CLAUDE_BLOCK, CLAUDE_START, CLAUDE_END, findings, { required: true, harness: "claude", equivalent: hasAgentsImport });
  if (bridgeEnabled(harness, "gemini")) await inspectManaged(target, "GEMINI.md", GEMINI_BLOCK, GEMINI_START, GEMINI_END, findings, { required: true, harness: "gemini", equivalent: hasAgentsImport });

  for (const spec of LINK_SPECS) {
    if (!bridgeEnabled(harness, spec.harness)) continue;
    const inspection = await inspectLink(target, spec);
    if (inspection.kind === "missing") findings.push(item("SKILLS_LINK_MANUAL_FALLBACK", "warning", `${spec.link} is missing; ${spec.harness} must read .agents/skills manually.`, true, spec.link, spec.harness));
    else if (inspection.kind === "conflict") findings.push(item("SKILLS_LINK_CONFLICT", "error", inspection.reason, false, spec.link, spec.harness));
    else if (inspection.kind === "broken") findings.push(item("SKILLS_LINK_BROKEN", "error", `${spec.link} points to the canonical path, but .agents/skills is unavailable.`, false, spec.link, spec.harness));
  }

  if ((!harness || harness === "opencode") && !await hasGitContext(target)) {
    findings.push(item(
      "OPENCODE_NON_GIT_SKILLS_LIMITATION",
      "warning",
      "Tested OpenCode versions may not discover project Skills outside a Git worktree; RepoMemo will not initialize Git, so smoke-test Skill discovery in the installed OpenCode runtime.",
      false,
      ".agents/skills",
      "opencode"
    ));
  }

  if (await pathKind(path.join(target, ".git")) !== "missing") findings.push(item("TARGET_GIT_PRESENT", "info", "A .git entry is present; RepoMemo does not read or modify it.", false, ".git"));
  await inspectAncestors(target, findings);
  await inspectNestedAgents(target, findings);
  return findings;
}

export async function runDoctor(target: string, options: DoctorOptions): Promise<DoctorReport> {
  const changedPaths = options.repair ? await repair(target, options.harness) : [];
  const findings = await inspectProject(target, options.harness);
  for (const changedPath of changedPaths) findings.unshift(item("REPAIRED", "info", `Repaired ${changedPath}.`, false, changedPath));
  return {
    schemaVersion: 1,
    version: VERSION,
    target,
    healthy: !findings.some((finding) => finding.severity === "error"),
    changed: changedPaths.length > 0,
    findings,
    support: selectedAdapters(options.harness)
  };
}
