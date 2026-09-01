import { chmod, lstat, mkdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CliUsageError } from "./types.js";

export async function resolveTarget(input: string | undefined): Promise<string> {
  const requested = path.resolve(input ?? process.cwd());
  let details;
  try {
    details = await stat(requested);
  } catch {
    throw new CliUsageError(`target directory does not exist: ${requested}`);
  }
  if (!details.isDirectory()) throw new CliUsageError(`target is not a directory: ${requested}`);
  const resolved = await realpath(requested);
  if (path.dirname(resolved) === resolved) throw new CliUsageError(`refusing to use filesystem root as target: ${resolved}`);
  return resolved;
}

export function isProjectRelative(value: string): boolean {
  if (value === ".") return true;
  if (!value || /[\u0000-\u001f\u007f]/u.test(value) || /^[a-zA-Z]:/u.test(value) || path.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  const normalized = value.replaceAll("\\", "/");
  const result = path.posix.normalize(normalized);
  return result !== ".." && !result.startsWith("../") && !result.startsWith("/");
}

export async function readText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function pathKind(filePath: string): Promise<"missing" | "file" | "directory" | "symlink" | "other"> {
  try {
    const details = await lstat(filePath);
    if (details.isSymbolicLink()) return "symlink";
    if (details.isFile()) return "file";
    if (details.isDirectory()) return "directory";
    return "other";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
}

export async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.repomemo-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`);
  let mode: number | undefined;
  try {
    mode = (await stat(filePath)).mode;
  } catch {
    mode = undefined;
  }
  await writeFile(temporary, content, "utf8");
  if (mode !== undefined) await chmod(temporary, mode);
  try {
    await rename(temporary, filePath);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
