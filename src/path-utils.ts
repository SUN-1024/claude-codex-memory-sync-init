import { chmod, lstat, mkdir, open, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { CliUsageError } from "./types.js";

export class NonUtf8TextError extends Error {
  readonly filePath: string;

  constructor(filePath: string) {
    super(`${filePath} is not valid UTF-8; convert it explicitly before RepoMemo can modify or validate it`);
    this.name = "NonUtf8TextError";
    this.filePath = filePath;
  }
}

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
  const home = await realpath(os.homedir()).catch(() => path.resolve(os.homedir()));
  if (resolved === home) throw new CliUsageError(`refusing to use the user home directory as a project target: ${resolved}`);
  const temporaryCandidates = new Set([os.tmpdir()]);
  if (process.platform !== "win32") {
    temporaryCandidates.add("/tmp");
    temporaryCandidates.add("/var/tmp");
  }
  for (const candidate of temporaryCandidates) {
    const temporaryRoot = await realpath(candidate).catch(() => path.resolve(candidate));
    if (resolved === temporaryRoot) throw new CliUsageError(`refusing to use a shared or operating-system temporary root as a project target: ${resolved}`);
  }
  return resolved;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

interface LockOwner {
  pid: number;
  token: string;
  createdAt: number;
}

function parseLockOwner(content: string): LockOwner | undefined {
  try {
    const value = JSON.parse(content) as Partial<LockOwner>;
    if (typeof value.pid === "number" && typeof value.token === "string" && typeof value.createdAt === "number") return value as LockOwner;
  } catch {
    // A just-created lock can be empty until its owner metadata is flushed.
  }
  return undefined;
}

export async function withProjectInitLock<T>(target: string, action: () => Promise<T>): Promise<T> {
  const digest = createHash("sha256").update(target).digest("hex").slice(0, 24);
  const lockPath = path.join(os.tmpdir(), `repomemo-init-${digest}.lock`);
  const token = randomUUID();
  const owner: LockOwner = { pid: process.pid, token, createdAt: Date.now() };
  const deadline = Date.now() + 15_000;

  while (true) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(owner)}\n`, "utf8");
      } finally {
        await handle.close();
      }
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = parseLockOwner(await readFile(lockPath, "utf8").catch(() => ""));
      const lockDetails = await stat(lockPath).catch(() => undefined);
      const age = lockDetails ? Date.now() - lockDetails.mtimeMs : 0;
      const stale = existing
        ? !processIsAlive(existing.pid)
        : age > 5_000;
      if (stale) {
        if (!lockDetails) continue;
        const quarantine = `${lockPath}.stale-${randomUUID()}`;
        try {
          await rename(lockPath, quarantine);
        } catch (renameError) {
          if ((renameError as NodeJS.ErrnoException).code === "ENOENT") continue;
          throw renameError;
        }
        const moved = await stat(quarantine).catch(() => undefined);
        if (!moved || moved.dev !== lockDetails.dev || moved.ino !== lockDetails.ino) {
          if (await pathKind(lockPath) === "missing") await rename(quarantine, lockPath).catch(() => undefined);
          throw new Error(`RepoMemo lock changed while stale ownership was being reclaimed for ${target}`);
        }
        await unlink(quarantine);
        continue;
      }
      if (Date.now() >= deadline) throw new Error(`timed out waiting for another RepoMemo init on ${target}`);
      await new Promise((resolve) => setTimeout(resolve, 25 + Math.floor(Math.random() * 25)));
    }
  }

  try {
    return await action();
  } finally {
    const existing = parseLockOwner(await readFile(lockPath, "utf8").catch(() => ""));
    if (existing?.token === token) await unlink(lockPath).catch(() => undefined);
  }
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
    const bytes = await readFile(filePath);
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      throw new NonUtf8TextError(filePath);
    }
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
  await atomicWriteBatch([{ filePath, content }]);
}

export interface TextWrite {
  filePath: string;
  content: string;
}

interface StagedWrite extends TextWrite {
  temporary: string;
  backup: string;
  existed: boolean;
  backupCreated: boolean;
  committed: boolean;
}

/**
 * Stage every replacement before changing any destination, then use same-directory
 * renames and reversible backups. This keeps a multi-file init from exposing a
 * half-written contract when preparation or a later rename fails.
 */
export async function atomicWriteBatch(writes: TextWrite[]): Promise<void> {
  if (writes.length === 0) return;
  const token = `repomemo-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const staged: StagedWrite[] = [];
  try {
    for (const write of writes) {
      const directory = path.dirname(write.filePath);
      await mkdir(directory, { recursive: true });
      const base = path.basename(write.filePath);
      const temporary = path.join(directory, `.${base}.${token}.tmp`);
      const backup = path.join(directory, `.${base}.${token}.bak`);
      let mode: number | undefined;
      let existed = false;
      try {
        const details = await stat(write.filePath);
        mode = details.mode;
        existed = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const stagedWrite = { ...write, temporary, backup, existed, backupCreated: false, committed: false };
      staged.push(stagedWrite);
      await writeFile(temporary, write.content, "utf8");
      if (mode !== undefined) await chmod(temporary, mode);
    }

    for (const write of staged) {
      if (write.existed) {
        await rename(write.filePath, write.backup);
        write.backupCreated = true;
      }
      await rename(write.temporary, write.filePath);
      write.committed = true;
    }

    for (const write of staged) {
      if (write.backupCreated) await unlink(write.backup).catch(() => undefined);
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const write of [...staged].reverse()) {
      try {
        if (write.committed) await unlink(write.filePath);
        if (write.backupCreated) await rename(write.backup, write.filePath);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
      }
      await unlink(write.temporary).catch(() => undefined);
    }
    if (rollbackErrors.length > 0) {
      const original = error instanceof Error ? error.message : String(error);
      throw new Error(`${original}; rollback also failed: ${rollbackErrors.join("; ")}`);
    }
    throw error;
  }
}
