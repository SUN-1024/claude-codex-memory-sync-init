import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { getAdapter, getAdapters } from "./adapters.js";
import {
  AGENTS_BLOCK, AGENTS_END, AGENTS_START, DEPRECATED_LINK_SPECS,
  CLAUDE_BLOCK, CLAUDE_END, CLAUDE_START,
  GEMINI_BLOCK, GEMINI_END, GEMINI_START,
  LINK_SPECS, VERSION
} from "./constants.js";
import { createLink, inspectLink } from "./links.js";
import { applyManagedBlock, hasClaudeAgentsImport, hasGeminiAgentsImport, inspectManagedBlock } from "./managed-block.js";
import { atomicWrite, NonUtf8TextError, pathKind, readText } from "./path-utils.js";
import { applySkillAdoption, planSkillAdoption } from "./skill-adoption.js";
import { inspectSkills } from "./skills-doctor.js";
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
  const adoption = await planSkillAdoption(target, harness);
  if (!adoption.findings.some((entry) => entry.severity === "error") && adoption.roots.length > 0) {
    await applySkillAdoption(target, adoption);
    changed.push(...adoption.changes.map((entry) => entry.replace(/^(?:MOVE|LINK|REMOVE) /u, "")));
  }
  if (await repairManagedFile(target, "AGENTS.md", AGENTS_BLOCK, AGENTS_START, AGENTS_END, false)) changed.push("AGENTS.md");
  if (bridgeEnabled(harness, "claude") && await repairManagedFile(target, "CLAUDE.md", CLAUDE_BLOCK, CLAUDE_START, CLAUDE_END, true, hasClaudeAgentsImport)) changed.push("CLAUDE.md");
  if (bridgeEnabled(harness, "gemini") && await repairManagedFile(target, "GEMINI.md", GEMINI_BLOCK, GEMINI_START, GEMINI_END, true, hasGeminiAgentsImport)) changed.push("GEMINI.md");
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
  for (const spec of DEPRECATED_LINK_SPECS) {
    if (!bridgeEnabled(harness, spec.harness)) continue;
    const inspection = await inspectLink(target, spec);
    if (inspection.kind === "valid" || inspection.kind === "broken") {
      await unlink(path.join(target, spec.link));
      changed.push(spec.link);
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
  let content: string | undefined;
  try {
    content = await readText(absolutePath);
  } catch (error) {
    if (error instanceof NonUtf8TextError) {
      findings.push(item("MANAGED_FILE_NON_UTF8", "error", `${relativePath} is not valid UTF-8; RepoMemo will not rewrite it. Convert it explicitly, then retry.`, false, relativePath, options.harness));
      return;
    }
    throw error;
  }
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
  const ignored = new Set([
    ".git", ".hg", ".svn", ".venv", "venv", "node_modules", "vendor", "dist", "build", "target",
    ".test-dist", ".cache", ".next", ".nuxt", ".output", ".turbo", ".pnpm", ".yarn", "coverage"
  ]);
  const queue: Array<{ directory: string; depth: number }> = [{ directory: target, depth: 0 }];
  const maximumDirectories = 10_000;
  const maximumDepth = 64;
  let scanned = 0;
  while (queue.length > 0) {
    const next = queue.pop();
    if (!next) continue;
    const { directory, depth } = next;
    scanned += 1;
    if (scanned > maximumDirectories || depth > maximumDepth) {
      findings.push(item("NESTED_SCAN_LIMIT_REACHED", "warning", `Nested AGENTS.md scan stopped after ${Math.min(scanned, maximumDirectories)} directories or depth ${maximumDepth}; generated and dependency directories are skipped.`, false));
      return;
    }
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
      queue.push({ directory: child, depth: depth + 1 });
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
  else {
    try {
      findings.push(...validateState((await readText(statePath)) ?? ""));
    } catch (error) {
      if (error instanceof NonUtf8TextError) findings.push(item("STATE_NON_UTF8", "error", "AGENT_STATE.md is not valid UTF-8.", false, "AGENT_STATE.md"));
      else throw error;
    }
  }

  const skillsParentKind = await pathKind(path.join(target, ".agents"));
  if (skillsParentKind !== "directory") findings.push(item("SKILLS_PARENT_CONFLICT", "error", ".agents must be a real directory inside the project.", false, ".agents"));
  const skillsKind = await pathKind(path.join(target, ".agents", "skills"));
  if (skillsKind !== "directory") findings.push(item("SKILLS_ROOT_MISSING", "error", ".agents/skills must be a real directory.", false, ".agents/skills"));
  else if (await pathKind(path.join(target, ".agents", "skills", "README.md")) === "missing") findings.push(item("SKILLS_README_MISSING", "info", ".agents/skills/README.md is optional but helps preserve the empty canonical directory.", false, ".agents/skills/README.md"));
  if (skillsKind === "directory") findings.push(...await inspectSkills(target));

  if (bridgeEnabled(harness, "claude")) await inspectManaged(target, "CLAUDE.md", CLAUDE_BLOCK, CLAUDE_START, CLAUDE_END, findings, { required: true, harness: "claude", equivalent: hasClaudeAgentsImport });
  if (bridgeEnabled(harness, "gemini")) await inspectManaged(target, "GEMINI.md", GEMINI_BLOCK, GEMINI_START, GEMINI_END, findings, { required: true, harness: "gemini", equivalent: hasGeminiAgentsImport });

  const adoption = await planSkillAdoption(target, harness);
  findings.push(...adoption.findings);
  const adoptingRoots = new Set(adoption.roots.map((root) => root.relativePath));

  for (const spec of LINK_SPECS) {
    if (!bridgeEnabled(harness, spec.harness)) continue;
    if (adoptingRoots.has(spec.link)) continue;
    const inspection = await inspectLink(target, spec);
    if (inspection.kind === "missing") findings.push(item("SKILLS_LINK_MANUAL_FALLBACK", "warning", `${spec.link} is missing; ${spec.harness} must read .agents/skills manually.`, true, spec.link, spec.harness));
    else if (inspection.kind === "conflict") findings.push(item("SKILLS_LINK_CONFLICT", "error", inspection.reason, false, spec.link, spec.harness));
    else if (inspection.kind === "broken") findings.push(item("SKILLS_LINK_BROKEN", "error", `${spec.link} points to the canonical path, but .agents/skills is unavailable.`, false, spec.link, spec.harness));
  }

  for (const spec of DEPRECATED_LINK_SPECS) {
    if (!bridgeEnabled(harness, spec.harness)) continue;
    const inspection = await inspectLink(target, spec);
    if (inspection.kind === "valid" || inspection.kind === "broken") {
      findings.push(item("DEPRECATED_SKILLS_LINK", "warning", `${spec.link} is an obsolete RepoMemo bridge. Current ${spec.harness} reads .agents/skills natively; repair will remove the duplicate discovery path.`, true, spec.link, spec.harness));
    } else if (inspection.kind === "conflict" && !adoptingRoots.has(spec.link)) {
      findings.push(item("HARNESS_SKILLS_PATH_PRESENT", "warning", `${spec.link} contains independent Harness Skills in addition to .agents/skills; merge them to avoid duplicate names.`, false, spec.link, spec.harness));
    }
  }

  if (!harness || harness === "claude") {
    findings.push(item(
      "CLAUDE_SKILLS_MANUAL",
      "info",
      "Claude Code receives the canonical Skill instruction through CLAUDE.md and AGENTS.md, but does not natively catalog .agents/skills. RepoMemo intentionally avoids a .claude/skills alias because other supported Harnesses scan both paths and would report duplicates.",
      false,
      ".agents/skills",
      "claude"
    ));
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
  const changedPaths: string[] = [];
  const findings: Finding[] = [];
  try {
    if (options.repair) changedPaths.push(...await repair(target, options.harness));
    findings.push(...await inspectProject(target, options.harness));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof NonUtf8TextError ? "NON_UTF8_TEXT" : "FILESYSTEM_ERROR";
    findings.push(item(code, "error", `${message}. No unchecked repair was attempted; correct access or encoding and rerun doctor.`, false));
  }
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
