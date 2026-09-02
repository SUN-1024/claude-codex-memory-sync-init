import { mkdir, readlink, realpath, symlink, unlink } from "node:fs/promises";
import path from "node:path";
import { pathKind } from "./path-utils.js";

export interface LinkSpec {
  harness: string;
  link: string;
  target: string;
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
