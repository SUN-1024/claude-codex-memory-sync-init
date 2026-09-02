import { chmod, lstat, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
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
  ticket?: number;
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

async function readRenamedLock(filePath: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException).code;
      if (!new Set(["EACCES", "EBUSY", "ENOENT", "EPERM"]).has(code ?? "") || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function withProjectInitLock<T>(target: string, action: () => Promise<T>): Promise<T> {
  const digest = createHash("sha256").update(target).digest("hex").slice(0, 24);
  const temporaryRoot = os.tmpdir();
  const legacyLockPath = path.join(temporaryRoot, `repomemo-init-${digest}.lock`);
  const contenderPrefix = `repomemo-init-${digest}.contender-`;
  const choosingPrefix = `repomemo-init-${digest}.choosing-`;
  const token = randomUUID();
  let owner: LockOwner = { pid: process.pid, token, createdAt: Date.now() };
  const deadline = Date.now() + 15_000;
  const contenderPath = path.join(temporaryRoot, `${contenderPrefix}${token}`);
  const candidatePath = `${contenderPath}.candidate`;
  const choosingPath = path.join(temporaryRoot, `${choosingPrefix}${token}`);

  try {
    await writeFile(choosingPath, `${JSON.stringify(owner)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    let maximumTicket = 0;
    for (const name of await readdir(temporaryRoot)) {
      if (!name.startsWith(contenderPrefix) || name.endsWith(".candidate")) continue;
      const parsed = parseLockOwner(await readFile(path.join(temporaryRoot, name), "utf8").catch(() => ""));
      maximumTicket = Math.max(maximumTicket, parsed?.ticket ?? 0);
    }
    owner = { ...owner, ticket: maximumTicket + 1 };
    await writeFile(candidatePath, `${JSON.stringify(owner)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(candidatePath, contenderPath);
    await unlink(choosingPath);
  } catch (error) {
    await unlink(candidatePath).catch(() => undefined);
    await unlink(choosingPath).catch(() => undefined);
    await unlink(contenderPath).catch(() => undefined);
    throw error;
  }

  try {
    while (true) {
      const contenders: LockOwner[] = [];
      let anotherChoosing = false;
      for (const name of await readdir(temporaryRoot)) {
        const isChoosing = name.startsWith(choosingPrefix);
        const isCandidate = name.startsWith(contenderPrefix) && name.endsWith(".candidate");
        const isContender = name.startsWith(contenderPrefix) && !isCandidate;
        if (isCandidate) {
          const candidate = path.join(temporaryRoot, name);
          const content = await readFile(candidate, "utf8").catch(() => "");
          const parsed = parseLockOwner(content);
          const details = await stat(candidate).catch(() => undefined);
          if (details && (parsed ? !processIsAlive(parsed.pid) : Date.now() - details.mtimeMs > 5_000)) {
            await unlink(candidate).catch(() => undefined);
          }
          continue;
        }
        if (!isChoosing && !isContender) continue;
        const contender = path.join(temporaryRoot, name);
        const content = await readFile(contender, "utf8").catch(() => "");
        const parsed = parseLockOwner(content);
        const details = await stat(contender).catch(() => undefined);
        if (!details) continue;
        const stale = parsed ? !processIsAlive(parsed.pid) : Date.now() - details.mtimeMs > 5_000;
        if (stale) {
          await unlink(contender).catch(() => undefined);
          continue;
        }
        if (isChoosing) anotherChoosing = true;
        else if (parsed) contenders.push(parsed);
      }
      contenders.sort((left, right) => (left.ticket ?? 0) - (right.ticket ?? 0) || left.token.localeCompare(right.token));

      if (!anotherChoosing && contenders[0]?.token === token) {
        const legacyContent = await readFile(legacyLockPath, "utf8").catch(() => undefined);
        if (legacyContent === undefined) break;
        const legacyOwner = parseLockOwner(legacyContent);
        const legacyDetails = await stat(legacyLockPath).catch(() => undefined);
        const legacyStale = legacyOwner
          ? !processIsAlive(legacyOwner.pid)
          : legacyDetails !== undefined && Date.now() - legacyDetails.mtimeMs > 5_000;
        if (legacyStale && legacyDetails) {
          const quarantine = `${legacyLockPath}.stale-${token}`;
          try {
            await rename(legacyLockPath, quarantine);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
            throw error;
          }
          // Windows can briefly report a renamed file as unavailable even after
          // rename() has completed. Retry only those transient filesystem errors;
          // treating every read failure as a content mismatch creates a false
          // fail-closed error and can strand an otherwise recoverable stale lock.
          const movedContent = await readRenamedLock(quarantine);
          if (movedContent !== legacyContent) {
            if (await pathKind(legacyLockPath) === "missing") await rename(quarantine, legacyLockPath).catch(() => undefined);
            throw new Error(`RepoMemo legacy lock changed while stale ownership was being reclaimed for ${target}`);
          }
          await unlink(quarantine);
          continue;
        }
      }

      if (Date.now() >= deadline) throw new Error(`timed out waiting for another RepoMemo init on ${target}`);
      await new Promise((resolve) => setTimeout(resolve, 25 + Math.floor(Math.random() * 25)));
    }

    return await action();
  } finally {
    await unlink(choosingPath).catch(() => undefined);
    await unlink(candidatePath).catch(() => undefined);
    await unlink(contenderPath).catch(() => undefined);
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
