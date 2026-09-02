import { mkdir, readlink, realpath, rename, symlink, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathKind } from "./path-utils.js";

export interface LinkSpec {
  harness: string;
  consumers?: readonly string[];
  link: string;
  target: string;
}

export function linkAppliesToHarness(spec: LinkSpec, harness: string | undefined): boolean {
  return !harness || spec.harness === harness || spec.consumers?.includes(harness) === true;
}

export type LinkInspection =
  | { kind: "missing" }
  | { kind: "valid"; rawTarget: string }
  | { kind: "broken"; rawTarget: string }
  | { kind: "conflict"; reason: string };

function normalize(filePath: string): string {
  const withoutNamespace = filePath.replace(/^\\\\\?\\/u, "");
  const normalized = path.normalize(withoutNamespace);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export async function inspectLink(root: string, spec: LinkSpec): Promise<LinkInspection> {
  const linkPath = path.join(root, spec.link);
  const parentPath = path.dirname(linkPath);
  const parentKind = await pathKind(parentPath);
  if (parentKind !== "missing" && parentKind !== "directory") {
    return { kind: "conflict", reason: `${path.dirname(spec.link)} exists and is not a real directory` };
  }
  if (parentKind === "missing") return { kind: "missing" };
  const kind = await pathKind(linkPath);
  if (kind === "missing") return { kind: "missing" };
  if (kind !== "symlink") return { kind: "conflict", reason: `${spec.link} exists and is not a link` };
  const rawTarget = await readlink(linkPath);
  const resolved = path.resolve(path.dirname(linkPath), rawTarget);
  const expected = path.resolve(root, spec.target);
  const canonicalResolved = await realpath(resolved).catch(() => resolved);
  const canonicalExpected = await realpath(expected).catch(() => expected);
  if (normalize(canonicalResolved) !== normalize(canonicalExpected)) return { kind: "conflict", reason: `${spec.link} points outside the canonical skills path` };
  const targetKind = await pathKind(expected);
  return targetKind === "directory" ? { kind: "valid", rawTarget } : { kind: "broken", rawTarget };
}

export async function createLink(root: string, spec: LinkSpec, replaceExact = false): Promise<void> {
  const linkPath = path.join(root, spec.link);
  const expected = path.resolve(root, spec.target);
  await mkdir(path.dirname(linkPath), { recursive: true });
  if (await pathKind(path.dirname(linkPath)) !== "directory") {
    throw new Error(`${path.dirname(spec.link)} is not a real directory`);
  }
  if (await pathKind(path.join(root, path.dirname(spec.target))) !== "directory") {
    throw new Error(`${path.dirname(spec.target)} is not a real directory`);
  }
  if (await pathKind(expected) !== "directory") throw new Error(`${spec.target} is not a real directory`);
  if (replaceExact) await unlink(linkPath);
  if (process.platform === "win32") await symlink(expected, linkPath, "junction");
  else await symlink(path.relative(path.dirname(linkPath), expected), linkPath, "dir");
}

interface StagedLinkRemoval {
  spec: LinkSpec;
  original: string;
  backup: string;
}

export interface LinkRemovalTransaction {
  commit(): Promise<string[]>;
  rollback(): Promise<void>;
}

/**
 * Move exact managed aliases out of their discovery paths before any other
 * mutation. The moved entry is inspected again so a check/rename race can
 * never turn a user-controlled replacement into an unlink target.
 */
export async function stageLinkRemovals(root: string, specs: readonly LinkSpec[]): Promise<LinkRemovalTransaction> {
  const staged: StagedLinkRemoval[] = [];
  const rollback = async (): Promise<void> => {
    const errors: string[] = [];
    for (const entry of [...staged].reverse()) {
      try {
        if (await pathKind(entry.original) !== "missing") throw new Error(`${entry.spec.link} changed while its obsolete alias was staged`);
        await rename(entry.backup, entry.original);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (errors.length > 0) throw new Error(`deprecated-link rollback failed: ${errors.join("; ")}`);
  };

  try {
    for (const spec of specs) {
      const original = path.join(root, spec.link);
      const backupRelative = path.join(path.dirname(spec.link), `.${path.basename(spec.link)}.repomemo-remove-${randomUUID()}`);
      const backup = path.join(root, backupRelative);
      await rename(original, backup);
      const moved = await inspectLink(root, { ...spec, link: backupRelative });
      if (moved.kind !== "valid" && moved.kind !== "broken") {
        await rename(backup, original);
        throw new Error(`${spec.link} changed before RepoMemo could stage the exact obsolete alias`);
      }
      staged.push({ spec, original, backup });
    }
  } catch (error) {
    try {
      await rollback();
    } catch (rollbackError) {
      const original = error instanceof Error ? error.message : String(error);
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new Error(`${original}; ${rollbackMessage}`);
    }
    throw error;
  }

  return {
    rollback,
    commit: async () => {
      const cleanupErrors: string[] = [];
      for (const entry of staged) {
        try {
          await unlink(entry.backup);
        } catch (error) {
          cleanupErrors.push(`${path.relative(root, entry.backup)}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return cleanupErrors;
    }
  };
}
