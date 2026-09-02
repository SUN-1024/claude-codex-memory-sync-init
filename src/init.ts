import { mkdir, rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import {
  AGENTS_BLOCK, AGENTS_END, AGENTS_START, DEPRECATED_LINK_SPECS,
  CLAUDE_BLOCK, CLAUDE_END, CLAUDE_START,
  GEMINI_BLOCK, GEMINI_END, GEMINI_START,
  LINK_SPECS, SKILLS_README
} from "./constants.js";
import { createLink, inspectLink } from "./links.js";
import { applyManagedBlock, hasClaudeAgentsImport, hasGeminiAgentsImport } from "./managed-block.js";
import { atomicWriteBatch, NonUtf8TextError, pathKind, readText, withProjectInitLock } from "./path-utils.js";
import { applySkillAdoption, planSkillAdoption } from "./skill-adoption.js";
import { createState, validateState } from "./state.js";
import type { Finding } from "./types.js";
import { detectV1 } from "./v1.js";

interface TextPlan {
  path: string;
  action: "created" | "updated" | "unchanged";
  content?: string;
}

export interface InitResult {
  changes: string[];
  findings: Finding[];
  dryRun: boolean;
}

interface InitDependencies {
  createLink?: typeof createLink;
}

function conflict(code: string, message: string, filePath?: string, harness?: string): Finding {
  return {
    code,
    severity: "error",
    message,
    repairable: false,
    ...(filePath ? { path: filePath } : {}),
    ...(harness ? { harness } : {})
  };
}

async function managedPlan(
  target: string,
  relativePath: string,
  block: string,
  start: string,
  end: string,
  equivalent?: (content: string) => boolean
): Promise<{ plan?: TextPlan; finding?: Finding }> {
  const absolutePath = path.join(target, relativePath);
  const kind = await pathKind(absolutePath);
  if (kind !== "missing" && kind !== "file") {
    return { finding: conflict("MANAGED_FILE_CONFLICT", `${relativePath} exists and is not a regular file.`, relativePath) };
  }
  let existing: string | undefined;
  try {
    existing = await readText(absolutePath);
  } catch (error) {
    if (error instanceof NonUtf8TextError) {
      return { finding: conflict("MANAGED_FILE_NON_UTF8", `${relativePath} is not valid UTF-8; convert it explicitly before running init. No bytes were changed.`, relativePath) };
    }
    throw error;
  }
  const applied = applyManagedBlock(existing, block, { start, end }, equivalent);
  if (applied.kind === "malformed") return { finding: conflict("MANAGED_BLOCK_MALFORMED", `${relativePath}: ${applied.reason}`, relativePath) };
  return {
    plan: {
      path: relativePath,
      action: applied.kind,
      ...(applied.kind === "unchanged" ? {} : { content: applied.content })
    }
  };
}

export async function runInit(target: string, dryRun: boolean, dependencies: InitDependencies = {}): Promise<InitResult> {
  if (dryRun) return runInitUnlocked(target, dryRun, dependencies);
  return withProjectInitLock(target, () => runInitUnlocked(target, dryRun, dependencies));
}

async function runInitUnlocked(target: string, dryRun: boolean, dependencies: InitDependencies): Promise<InitResult> {
  const findings: Finding[] = [];
  const plans: TextPlan[] = [];
  const linkCreator = dependencies.createLink ?? createLink;

  if (await detectV1(target)) {
    return {
      dryRun,
      changes: [],
      findings: [conflict("V1_SIGNATURE_DETECTED", "RepoMemo v1 was detected. No files were changed. Follow MIGRATION-v1-v2.md and run init again after manual migration.")]
    };
  }

  const managedRequests: Array<{
    relativePath: string;
    block: string;
    start: string;
    end: string;
    equivalent?: (content: string) => boolean;
  }> = [
    { relativePath: "AGENTS.md", block: AGENTS_BLOCK, start: AGENTS_START, end: AGENTS_END },
    { relativePath: "CLAUDE.md", block: CLAUDE_BLOCK, start: CLAUDE_START, end: CLAUDE_END, equivalent: hasClaudeAgentsImport },
    { relativePath: "GEMINI.md", block: GEMINI_BLOCK, start: GEMINI_START, end: GEMINI_END, equivalent: hasGeminiAgentsImport }
  ];
  for (const request of managedRequests) {
    const result = await managedPlan(
      target,
      request.relativePath,
      request.block,
      request.start,
      request.end,
      request.equivalent
    );
    if (result.finding) findings.push(result.finding);
    if (result.plan) plans.push(result.plan);
  }

  const statePath = path.join(target, "AGENT_STATE.md");
  const stateKind = await pathKind(statePath);
  let existingState: string | undefined;
  if (stateKind === "missing" || stateKind === "file") {
    try {
      existingState = await readText(statePath);
    } catch (error) {
      if (error instanceof NonUtf8TextError) findings.push(conflict("STATE_NON_UTF8", "AGENT_STATE.md is not valid UTF-8; it was not changed.", "AGENT_STATE.md"));
      else throw error;
    }
  }
  if (stateKind !== "missing" && stateKind !== "file") findings.push(conflict("STATE_FILE_CONFLICT", "AGENT_STATE.md exists and is not a regular file; it was not changed.", "AGENT_STATE.md"));
  if (existingState === undefined && stateKind === "missing") plans.splice(1, 0, { path: "AGENT_STATE.md", action: "created", content: createState() });
  else {
    if (existingState !== undefined) {
      const stateErrors = validateState(existingState).filter((entry) => entry.severity === "error");
      if (stateErrors.length > 0) findings.push(conflict("STATE_CONFLICT", "Existing AGENT_STATE.md does not match the RepoMemo state schema; it was not changed.", "AGENT_STATE.md"));
      else plans.splice(1, 0, { path: "AGENT_STATE.md", action: "unchanged" });
    }
  }

  const agentsDirectoryPath = path.join(target, ".agents");
  const agentsDirectoryKind = await pathKind(agentsDirectoryPath);
  const agentsDirectorySafe = agentsDirectoryKind === "missing" || agentsDirectoryKind === "directory";
  if (!agentsDirectorySafe) findings.push(conflict("SKILLS_PARENT_CONFLICT", ".agents must be a real directory inside the project.", ".agents"));
  const skillsPath = path.join(agentsDirectoryPath, "skills");
  const skillsKind = agentsDirectorySafe ? await pathKind(skillsPath) : "other";
  const adoption = agentsDirectorySafe ? await planSkillAdoption(target) : { roots: [], destinationNames: new Set<string>(), changes: [], findings: [] };
  findings.push(...adoption.findings.filter((entry) => entry.severity === "error"));
  if (agentsDirectorySafe) {
    if (skillsKind !== "missing" && skillsKind !== "directory") findings.push(conflict("SKILLS_ROOT_CONFLICT", ".agents/skills must be a real directory and the canonical Skill source.", ".agents/skills"));
    const skillsReadmePath = path.join(skillsPath, "README.md");
    const skillsReadmeKind = skillsKind === "missing" || skillsKind === "directory" ? await pathKind(skillsReadmePath) : "other";
    if (skillsReadmeKind === "missing" && !adoption.destinationNames.has("README.md")) plans.splice(2, 0, { path: ".agents/skills/README.md", action: "created", content: SKILLS_README });
    else if (skillsReadmeKind !== "file" && skillsKind === "directory") findings.push(conflict("SKILLS_README_CONFLICT", ".agents/skills/README.md exists and is not a file.", ".agents/skills/README.md"));
    else if (skillsReadmeKind === "file") plans.splice(2, 0, { path: ".agents/skills/README.md", action: "unchanged" });
  }

  const linkActions: Array<(typeof LINK_SPECS)[number]> = [];
  const adoptingRoots = new Set(adoption.roots.map((root) => root.relativePath));
  for (const spec of LINK_SPECS) {
    if (adoptingRoots.has(spec.link)) continue;
    const inspection = await inspectLink(target, spec);
    if (inspection.kind === "conflict") findings.push(conflict("SKILLS_LINK_CONFLICT", inspection.reason, spec.link, spec.harness));
    else if (inspection.kind === "missing") linkActions.push(spec);
  }

  const deprecatedLinkRemovals: Array<(typeof DEPRECATED_LINK_SPECS)[number]> = [];
  for (const spec of DEPRECATED_LINK_SPECS) {
    if (adoptingRoots.has(spec.link)) continue;
    const inspection = await inspectLink(target, spec);
    if (inspection.kind === "valid" || inspection.kind === "broken") deprecatedLinkRemovals.push(spec);
  }

  if (findings.some((entry) => entry.severity === "error")) return { dryRun, changes: [], findings };

  const textChanges = plans
    .filter((plan) => plan.action !== "unchanged")
    .map((plan) => `${plan.action === "created" ? "CREATE" : "UPDATE"} ${plan.path}`);
  if (dryRun) {
    return {
      dryRun,
      changes: [
        ...textChanges,
        ...adoption.changes,
        ...deprecatedLinkRemovals.map((spec) => `REMOVE deprecated ${spec.link}`),
        ...linkActions.map((spec) => `LINK ${spec.link} -> ${spec.target}`)
      ],
      findings
    };
  }

  await mkdir(skillsPath, { recursive: true });
  let rollbackAdoption: (() => Promise<void>) | undefined;
  try {
    if (adoption.roots.length > 0) rollbackAdoption = await applySkillAdoption(target, adoption);
    await atomicWriteBatch(plans
      .filter((plan) => plan.action !== "unchanged" && plan.content !== undefined)
      .map((plan) => ({ filePath: path.join(target, plan.path), content: plan.content ?? "" })));
  } catch (error) {
    if (rollbackAdoption) await rollbackAdoption().catch(() => undefined);
    if (skillsKind === "missing") await rmdir(skillsPath).catch(() => undefined);
    if (agentsDirectoryKind === "missing") await rmdir(agentsDirectoryPath).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    return {
      dryRun,
      changes: [],
      findings: [conflict("INITIALIZATION_IO_ERROR", `${message}. RepoMemo rolled back staged file changes where possible; run doctor before retrying.`)]
    };
  }
  const changes = [...textChanges, ...adoption.changes];
  for (const spec of deprecatedLinkRemovals) {
    try {
      await unlink(path.join(target, spec.link));
      changes.push(`REMOVE deprecated ${spec.link}`);
    } catch (error) {
      const inspection = await inspectLink(target, spec);
      if (inspection.kind === "valid" || inspection.kind === "broken") {
        findings.push({
          code: "DEPRECATED_LINK_REMOVE_FAILED",
          severity: "warning",
          message: `Could not remove obsolete ${spec.link}: ${(error as Error).message}`,
          path: spec.link,
          harness: spec.harness,
          repairable: true
        });
      }
    }
  }
  for (const spec of linkActions) {
    try {
      await linkCreator(target, spec);
      changes.push(`LINK ${spec.link} -> ${spec.target}`);
    } catch (error) {
      const raced = await inspectLink(target, spec);
      if (raced.kind === "valid") continue;
      findings.push({
        code: "SKILLS_LINK_MANUAL_FALLBACK",
        severity: "warning",
        message: `Could not create ${spec.link}; ${spec.harness} must read .agents/skills manually until repair succeeds: ${(error as Error).message}`,
        path: spec.link,
        harness: spec.harness,
        repairable: true
      });
    }
  }
  return { dryRun, changes, findings };
}
