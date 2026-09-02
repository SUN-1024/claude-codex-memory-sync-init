import { mkdir, readdir, rename, rmdir } from "node:fs/promises";
import path from "node:path";
import { pathKind } from "./path-utils.js";
import { inspectSkillRoot } from "./skills-doctor.js";
import type { Finding } from "./types.js";

interface VendorRoot {
  harness: string;
  relativePath: string;
}

const VENDOR_ROOTS: VendorRoot[] = [
  { harness: "claude", relativePath: ".claude/skills" },
  { harness: "zcode", relativePath: ".zcode/skills" }
];

interface SkillMove {
  source: string;
  destination: string;
  sourceRelative: string;
  destinationRelative: string;
}

interface PlannedRoot extends VendorRoot {
  absolutePath: string;
  moves: SkillMove[];
}

export interface SkillAdoptionPlan {
  roots: PlannedRoot[];
  destinationNames: Set<string>;
  changes: string[];
  findings: Finding[];
}

function finding(code: string, severity: Finding["severity"], message: string, repairable: boolean, filePath: string, harness: string): Finding {
  return { code, severity, message, repairable, path: filePath, harness };
}

export async function planSkillAdoption(target: string, harness?: string): Promise<SkillAdoptionPlan> {
  const canonical = path.join(target, ".agents", "skills");
  const canonicalKind = await pathKind(canonical);
  const findings: Finding[] = [];
  const roots: PlannedRoot[] = [];
  const destinationNames = new Set<string>();

  if (canonicalKind !== "missing" && canonicalKind !== "directory") {
    return {
      roots,
      destinationNames,
      changes: [],
      findings: [finding("SKILLS_ROOT_CONFLICT", "error", ".agents/skills must be a real directory before existing Harness Skills can be adopted.", false, ".agents/skills", "claude")]
    };
  }

  if (canonicalKind === "directory") {
    for (const name of await readdir(canonical)) destinationNames.add(name);
  }

  for (const vendor of VENDOR_ROOTS) {
    if (harness && vendor.harness !== harness) continue;
    const absolutePath = path.join(target, vendor.relativePath);
    if (await pathKind(absolutePath) !== "directory") continue;
    const portabilityFindings = (await inspectSkillRoot(absolutePath, vendor.relativePath))
      .map((entry) => ({ ...entry, harness: vendor.harness }));
    if (portabilityFindings.some((entry) => entry.severity === "error")) {
      findings.push(...portabilityFindings);
      continue;
    }
    const names = await readdir(absolutePath);
    const moves: SkillMove[] = [];
    for (const name of names) {
      if (destinationNames.has(name)) {
        findings.push(finding(
          "SKILLS_MIGRATION_CONFLICT",
          "error",
          `${vendor.relativePath}/${name} conflicts with .agents/skills/${name}; RepoMemo left both copies untouched. Rename or merge that entry, then run init or repair again.`,
          false,
          `${vendor.relativePath}/${name}`,
          vendor.harness
        ));
        continue;
      }
      destinationNames.add(name);
      moves.push({
        source: path.join(absolutePath, name),
        destination: path.join(canonical, name),
        sourceRelative: `${vendor.relativePath}/${name}`,
        destinationRelative: `.agents/skills/${name}`
      });
    }
    roots.push({ ...vendor, absolutePath, moves });
  }

  if (findings.some((entry) => entry.severity === "error")) {
    return { roots: [], destinationNames, changes: [], findings };
  }

  const changes: string[] = [];
  for (const root of roots) {
    for (const move of root.moves) changes.push(`MOVE ${move.sourceRelative} -> ${move.destinationRelative}`);
    changes.push(`REMOVE adopted ${root.relativePath}`);
    findings.push(finding(
      "SKILLS_VENDOR_DIRECTORY_ADOPTABLE",
      "warning",
      `${root.relativePath} is a real Harness-specific directory. RepoMemo can move its entries into .agents/skills without changing their bytes, then remove the duplicate discovery root.`,
      true,
      root.relativePath,
      root.harness
    ));
  }

  return { roots, destinationNames, changes, findings };
}

export async function applySkillAdoption(target: string, plan: SkillAdoptionPlan): Promise<() => Promise<void>> {
  if (plan.findings.some((entry) => entry.severity === "error")) throw new Error("cannot apply a conflicting Skill adoption plan");
  const canonical = path.join(target, ".agents", "skills");
  const moved: SkillMove[] = [];
  const removedRoots: PlannedRoot[] = [];

  const rollback = async (): Promise<void> => {
    for (const root of [...removedRoots].reverse()) await mkdir(root.absolutePath, { recursive: true });
    for (const move of [...moved].reverse()) {
      await mkdir(path.dirname(move.source), { recursive: true });
      await rename(move.destination, move.source);
    }
  };

  try {
    await mkdir(canonical, { recursive: true });
    for (const root of plan.roots) {
      for (const move of root.moves) {
        await rename(move.source, move.destination);
        moved.push(move);
      }
      await rmdir(root.absolutePath);
      removedRoots.push(root);
    }
    return rollback;
  } catch (error) {
    try {
      await rollback();
    } catch (rollbackError) {
      const original = error instanceof Error ? error.message : String(error);
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new Error(`${original}; Skill migration rollback also failed: ${rollbackMessage}`);
    }
    throw error;
  }
}
