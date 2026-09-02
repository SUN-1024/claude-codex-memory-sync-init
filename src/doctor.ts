import { readdir } from "node:fs/promises";
import path from "node:path";
import { getAdapter, getAdapters } from "./adapters.js";
import {
  AGENTS_BLOCK, AGENTS_END, AGENTS_START, DEPRECATED_LINK_SPECS,
  CLAUDE_BLOCK, CLAUDE_END, CLAUDE_START,
  GEMINI_BLOCK, GEMINI_END, GEMINI_START,
  LINK_SPECS, VERSION
} from "./constants.js";
import { createLink, inspectLink, linkAppliesToHarness, stageLinkRemovals, type LinkRemovalTransaction } from "./links.js";
import { applyManagedBlock, hasClaudeAgentsImport, hasGeminiAgentsImport, inspectManagedBlock } from "./managed-block.js";
import { atomicWriteBatch, NonUtf8TextError, pathKind, readText, withProjectInitLock, type TextWrite } from "./path-utils.js";
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

async function planManagedRepair(
  target: string,
  relativePath: string,
  block: string,
  start: string,
  end: string,
  createWhenMissing: boolean,
  equivalent?: (content: string) => boolean
): Promise<TextWrite | undefined> {
  const filePath = path.join(target, relativePath);
  const kind = await pathKind(filePath);
  if (kind !== "missing" && kind !== "file") return undefined;
  const existing = await readText(filePath);
  if (existing === undefined && !createWhenMissing) return undefined;
  const applied = applyManagedBlock(existing, block, { start, end }, equivalent);
  if (applied.kind === "malformed" || applied.kind === "unchanged") return undefined;
  if (existing !== undefined && inspectManagedBlock(existing, { start, end }).kind === "absent" && !equivalent?.(existing)) return undefined;
  return { filePath, content: applied.content };
}

interface RepairResult {
  changed: string[];
  findings: Finding[];
}

async function repair(target: string, harness: string | undefined): Promise<RepairResult> {
  const changed: string[] = [];
  const repairFindings: Finding[] = [];
  const adoption = await planSkillAdoption(target, harness);
  const textPlans: Array<{ relativePath: string; write: TextWrite }> = [];
  const agents = await planManagedRepair(target, "AGENTS.md", AGENTS_BLOCK, AGENTS_START, AGENTS_END, false);
  if (agents) textPlans.push({ relativePath: "AGENTS.md", write: agents });
  if (bridgeEnabled(harness, "claude")) {
    const claude = await planManagedRepair(target, "CLAUDE.md", CLAUDE_BLOCK, CLAUDE_START, CLAUDE_END, true, hasClaudeAgentsImport);
    if (claude) textPlans.push({ relativePath: "CLAUDE.md", write: claude });
  }
  if (bridgeEnabled(harness, "gemini")) {
    const gemini = await planManagedRepair(target, "GEMINI.md", GEMINI_BLOCK, GEMINI_START, GEMINI_END, true, hasGeminiAgentsImport);
    if (gemini) textPlans.push({ relativePath: "GEMINI.md", write: gemini });
  }

  const deprecatedLinkRemovals: Array<(typeof DEPRECATED_LINK_SPECS)[number]> = [];
  for (const spec of DEPRECATED_LINK_SPECS) {
    if (!linkAppliesToHarness(spec, harness)) continue;
    const inspection = await inspectLink(target, spec);
    if (inspection.kind === "valid" || inspection.kind === "broken") deprecatedLinkRemovals.push(spec);
  }

  let linkRemoval: LinkRemovalTransaction | undefined;
  let rollbackAdoption: (() => Promise<void>) | undefined;
  try {
    linkRemoval = await stageLinkRemovals(target, deprecatedLinkRemovals);
    if (!adoption.findings.some((entry) => entry.severity === "error") && adoption.roots.length > 0) {
      rollbackAdoption = await applySkillAdoption(target, adoption);
    }
    await atomicWriteBatch(textPlans.map((plan) => plan.write));
  } catch (error) {
    const rollbackErrors: string[] = [];
    if (rollbackAdoption) {
      try { await rollbackAdoption(); } catch (rollbackError) { rollbackErrors.push(`Skill adoption: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`); }
    }
    if (linkRemoval) {
      try { await linkRemoval.rollback(); } catch (rollbackError) { rollbackErrors.push(`deprecated links: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`); }
    }
    if (rollbackErrors.length === 0) throw error;
    const original = error instanceof Error ? error.message : String(error);
    throw new Error(`${original}; rollback also failed: ${rollbackErrors.join("; ")}`);
  }
  for (const root of adoption.roots) {
    for (const move of root.moves) changed.push(move.destinationRelative);
    changed.push(root.relativePath);
  }
  changed.push(...textPlans.map((plan) => plan.relativePath));
  changed.push(...deprecatedLinkRemovals.map((spec) => spec.link));
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
  for (const cleanupError of await linkRemoval?.commit() ?? []) {
    repairFindings.push(item(
      "DEPRECATED_LINK_CLEANUP_FAILED",
      "warning",
      `The obsolete discovery path was removed, but its hidden staged alias could not be deleted: ${cleanupError}`,
      true
    ));
  }
  return { changed, findings: repairFindings };
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

function ancestorNames(harness: string | undefined): string[] {
  if (!harness) return [".git", "AGENTS.md", "CLAUDE.md", "GEMINI.md"];
  if (harness === "claude") return [".git", "CLAUDE.md"];
  if (harness === "gemini") return [".git", "GEMINI.md"];
  return [".git", "AGENTS.md"];
}

async function inspectAncestors(target: string, findings: Finding[], harness: string | undefined): Promise<void> {
  let current = path.dirname(target);
  while (true) {
    for (const name of ancestorNames(harness)) {
      const ancestorPath = path.join(current, name);
      if (await pathKind(ancestorPath) !== "missing") findings.push(item("AMBIENT_ANCESTOR_CONTEXT", "info", `Ancestor context may affect Harness root or instructions: ${ancestorPath}`, false, ancestorPath, harness));
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

async function inspectNestedAgents(target: string, findings: Finding[], harness: string | undefined): Promise<void> {
  if (harness === "claude" || harness === "gemini") return;
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
      if (await pathKind(path.join(child, "AGENTS.md")) === "file") {
        const nestedPath = path.relative(target, path.join(child, "AGENTS.md"));
        findings.push(item("NESTED_AGENTS_HARNESS_DEPENDENT", "warning", `Nested AGENTS.md has Harness-specific semantics: ${nestedPath}`, false, nestedPath, harness));
      }
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
    if (inspection.kind === "missing") findings.push(item("SKILLS_LINK_MANUAL_FALLBACK", "warning", `${spec.link} is missing; ${spec.harness} cannot catalog the canonical project Skills until repair recreates the compatibility link.`, true, spec.link, spec.harness));
    else if (inspection.kind === "conflict") findings.push(item("SKILLS_LINK_CONFLICT", "error", inspection.reason, false, spec.link, spec.harness));
    else if (inspection.kind === "broken") findings.push(item("SKILLS_LINK_BROKEN", "error", `${spec.link} points to the canonical path, but .agents/skills is unavailable.`, false, spec.link, spec.harness));
    else findings.push(item("CROSS_HARNESS_SKILL_ALIAS", "info", `${spec.link} aliases .agents/skills for ${spec.harness}. It is one canonical Skill tree, not a converted copy.`, false, spec.link, spec.harness));
  }

  for (const spec of DEPRECATED_LINK_SPECS) {
    if (!linkAppliesToHarness(spec, harness)) continue;
    const inspection = await inspectLink(target, spec);
    if (inspection.kind === "valid" || inspection.kind === "broken") {
      findings.push(item("DEPRECATED_SKILLS_LINK", "error", `${spec.link} is an obsolete RepoMemo alias scanned by ${spec.consumers?.join(", ") ?? spec.harness}. It violates the single-canonical-root contract and can duplicate Skill discovery; repair will transactionally remove this exact alias without touching independent content.`, true, spec.link, harness ?? spec.harness));
    } else if (inspection.kind === "conflict" && !adoptingRoots.has(spec.link)) {
      findings.push(item("HARNESS_SKILLS_PATH_CONFLICT", "error", `${spec.link} is an independent or foreign Harness path in addition to .agents/skills. It is scanned by ${spec.consumers?.join(", ") ?? spec.harness}; merge portable Skills into the canonical root and remove the duplicate discovery path. RepoMemo will not touch it automatically.`, false, spec.link, harness ?? spec.harness));
    }
  }

  if (!harness || harness === "claude") findings.push(item(
    "CLAUDE_SKILLS_MANUAL",
    "info",
    "Claude Code receives the canonical Skill instruction through CLAUDE.md and AGENTS.md, but does not natively catalog .agents/skills. RepoMemo intentionally omits a .claude/skills alias because OpenCode, Cursor, and Copilot scan both paths and would discover every Skill twice.",
    false,
    ".agents/skills",
    "claude"
  ));

  if (!harness || harness === "opencode") findings.push(item(
    "OPENCODE_SKILLS_MANUAL",
    "info",
    "OpenCode 1.17.7 did not catalog project .agents/skills without the removed .claude alias, even in a Git worktree. AGENTS.md still instructs it to read applicable canonical Skills manually; the alias is not restored because it creates duplicate entries in multi-path scanners.",
    false,
    ".agents/skills",
    "opencode"
  ));

  if ((!harness || harness === "opencode") && !await hasGitContext(target)) {
    findings.push(item(
      "OPENCODE_NON_GIT_SKILLS_LIMITATION",
      "warning",
      "OpenCode also uses Git worktree boundaries for project discovery. RepoMemo will not initialize Git; in a non-Git directory, verify the effective project root in the installed OpenCode runtime.",
      false,
      ".agents/skills",
      "opencode"
    ));
  }

  if (harness) {
    const minimum = getAdapter(harness)?.evidence.minimumVersion;
    if (minimum) findings.push(item(
      "HARNESS_MINIMUM_VERSION",
      "warning",
      `${getAdapter(harness)?.name ?? harness} native Skill support requires version ${minimum} or newer. RepoMemo does not execute third-party Harness commands, so verify the installed runtime version before relying on native discovery.`,
      false,
      ".agents/skills",
      harness
    ));
  }

  if (await pathKind(path.join(target, ".git")) !== "missing") findings.push(item("TARGET_GIT_PRESENT", "info", "A .git entry is present; RepoMemo does not read or modify it.", false, ".git"));
  await inspectAncestors(target, findings, harness);
  await inspectNestedAgents(target, findings, harness);
  return findings;
}

async function runDoctorUnlocked(target: string, options: DoctorOptions): Promise<DoctorReport> {
  const changedPaths: string[] = [];
  const findings: Finding[] = [];
  try {
    if (options.repair) {
      const repaired = await repair(target, options.harness);
      changedPaths.push(...repaired.changed);
      findings.push(...repaired.findings);
    }
    findings.push(...await inspectProject(target, options.harness));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof NonUtf8TextError ? "NON_UTF8_TEXT" : "FILESYSTEM_ERROR";
    findings.push(item(code, "error", `${message}. The operation stopped; correct access or encoding, inspect the project with doctor, and retry.`, false));
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

export async function runDoctor(target: string, options: DoctorOptions): Promise<DoctorReport> {
  if (options.repair) {
    try {
      return await withProjectInitLock(target, () => runDoctorUnlocked(target, options));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        schemaVersion: 1,
        version: VERSION,
        target,
        healthy: false,
        changed: false,
        findings: [item("PROJECT_LOCK_ERROR", "error", `${message}. No repair was started; retry after the active RepoMemo writer finishes.`, false)],
        support: selectedAdapters(options.harness)
      };
    }
  }
  return runDoctorUnlocked(target, options);
}
