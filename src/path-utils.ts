import { chmod, link, lstat, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import type { Stats } from "node:fs";
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

const TRANSIENT_LOCK_ERRORS = new Set(["EACCES", "EBUSY", "EPERM"]);

async function waitForLockRetry(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
}

async function readLockFile(filePath: string, retryMissing = false): Promise<string | undefined> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" && !retryMissing) return undefined;
      if ((code !== "ENOENT" && !TRANSIENT_LOCK_ERRORS.has(code ?? "")) || attempt === 5) throw error;
      await waitForLockRetry(attempt);
    }
  }
  return undefined;
}

async function statLockFile(filePath: string): Promise<Stats | undefined> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await stat(filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return undefined;
      if (!TRANSIENT_LOCK_ERRORS.has(code ?? "") || attempt === 5) throw error;
      await waitForLockRetry(attempt);
    }
  }
  return undefined;
}

async function removeLockFile(filePath: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await unlink(filePath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return;
      if (!TRANSIENT_LOCK_ERRORS.has(code ?? "") || attempt === 5) throw error;
      await waitForLockRetry(attempt);
    }
  }
}

async function createLockFile(filePath: string, content: string): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await writeFile(filePath, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EEXIST") return false;
      if (!TRANSIENT_LOCK_ERRORS.has(code ?? "") || attempt === 5) throw error;
      await waitForLockRetry(attempt);
    }
  }
  return false;
}

async function moveLockFile(source: string, destination: string): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rename(source, destination);
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return false;
      if (!TRANSIENT_LOCK_ERRORS.has(code ?? "") || attempt === 5) throw error;
      await waitForLockRetry(attempt);
    }
  }
  return false;
}

async function restoreLockWithoutOverwrite(quarantine: string, lockPath: string): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await link(quarantine, lockPath);
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EEXIST") return false;
      if (!TRANSIENT_LOCK_ERRORS.has(code ?? "") || attempt === 5) throw error;
      await waitForLockRetry(attempt);
    }
  }
  await removeLockFile(quarantine);
  return true;
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
  const choosingCandidatePath = `${choosingPath}.candidate`;
  let legacyOwnerContent = "";

  try {
    if (!await createLockFile(choosingCandidatePath, `${JSON.stringify(owner)}\n`)) throw new Error(`RepoMemo lock chooser already exists for ${target}`);
    if (!await moveLockFile(choosingCandidatePath, choosingPath)) throw new Error(`RepoMemo lock chooser disappeared before publication for ${target}`);
    let maximumTicket = 0;
    for (const name of await readdir(temporaryRoot)) {
      if (!name.startsWith(contenderPrefix) || name.endsWith(".candidate")) continue;
      const content = await readLockFile(path.join(temporaryRoot, name));
      const parsed = content === undefined ? undefined : parseLockOwner(content);
      maximumTicket = Math.max(maximumTicket, parsed?.ticket ?? 0);
    }
    owner = { ...owner, ticket: maximumTicket + 1 };
    legacyOwnerContent = `${JSON.stringify({ ...owner, createdAt: Date.now() + 86_400_000 })}\n`;
    if (!await createLockFile(candidatePath, `${JSON.stringify(owner)}\n`)) throw new Error(`RepoMemo lock candidate already exists for ${target}`);
    if (!await moveLockFile(candidatePath, contenderPath)) throw new Error(`RepoMemo lock candidate disappeared before publication for ${target}`);
    await removeLockFile(choosingPath);
  } catch (error) {
    const cleanup = await Promise.allSettled([candidatePath, choosingCandidatePath, choosingPath, contenderPath].map(removeLockFile));
    const cleanupErrors = cleanup
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason);
    if (cleanupErrors.length > 0) throw new AggregateError([error, ...cleanupErrors], `RepoMemo lock setup and cleanup both failed for ${target}`);
    throw error;
  }

  try {
    while (true) {
      const contenders: LockOwner[] = [];
      let anotherChoosing = false;
      let electionSnapshotChanged = false;
      for (const name of await readdir(temporaryRoot)) {
        const isChoosing = name.startsWith(choosingPrefix);
        const isCandidate = name.startsWith(contenderPrefix) && name.endsWith(".candidate");
        const isContender = name.startsWith(contenderPrefix) && !isCandidate;
        if (!isChoosing && !isCandidate && !isContender) continue;
        const contender = path.join(temporaryRoot, name);
        const content = await readLockFile(contender);
        if (content === undefined) {
          electionSnapshotChanged = true;
          continue;
        }
        const parsed = parseLockOwner(content);
        const details = await statLockFile(contender);
        if (!details) {
          electionSnapshotChanged = true;
          continue;
        }
        const stale = parsed ? !processIsAlive(parsed.pid) : Date.now() - details.mtimeMs > 5_000;
        if (stale) {
          await removeLockFile(contender);
          continue;
        }
        if (isChoosing || isCandidate) anotherChoosing = true;
        else if (parsed) contenders.push(parsed);
        else throw new Error(`RepoMemo found an unreadable active lock contender for ${target}`);
      }
      contenders.sort((left, right) => (left.ticket ?? 0) - (right.ticket ?? 0) || left.token.localeCompare(right.token));

      if (electionSnapshotChanged) {
        if (Date.now() >= deadline) throw new Error(`timed out waiting for another RepoMemo init on ${target}`);
        await new Promise((resolve) => setTimeout(resolve, 25 + Math.floor(Math.random() * 25)));
        continue;
      }

      if (!anotherChoosing && contenders[0]?.token === token) {
        let quarantineBlocked = false;
        let quarantineSnapshotChanged = false;
        const legacyBase = path.basename(legacyLockPath);
        for (const name of await readdir(temporaryRoot)) {
          if (!name.startsWith(`${legacyBase}.stale-`) && !name.startsWith(`${legacyBase}.quarantine-`) && !name.startsWith(`${legacyBase}.release-`)) continue;
          const quarantinePath = path.join(temporaryRoot, name);
          const quarantineContent = await readLockFile(quarantinePath);
          if (quarantineContent === undefined) {
            quarantineSnapshotChanged = true;
            continue;
          }
          const quarantineOwner = parseLockOwner(quarantineContent);
          const quarantineDetails = await statLockFile(quarantinePath);
          if (!quarantineDetails) {
            quarantineSnapshotChanged = true;
            continue;
          }
          const quarantineStale = quarantineOwner ? !processIsAlive(quarantineOwner.pid) : Date.now() - quarantineDetails.mtimeMs > 5_000;
          if (quarantineStale) await removeLockFile(quarantinePath);
          else quarantineBlocked = true;
        }
        if (quarantineBlocked || quarantineSnapshotChanged) {
          if (Date.now() >= deadline) throw new Error(`timed out waiting for another RepoMemo init on ${target}`);
          await new Promise((resolve) => setTimeout(resolve, 25 + Math.floor(Math.random() * 25)));
          continue;
        }

        // Older RepoMemo releases reclaimed a live fixed-path lock after five
        // minutes. A future-dated compatibility lease keeps those releases out
        // for a full day; a crashed owner is still reclaimed immediately by PID.
        if (await createLockFile(legacyLockPath, legacyOwnerContent)) break;

        const legacyContent = await readLockFile(legacyLockPath);
        if (legacyContent === undefined) continue;
        const legacyOwner = parseLockOwner(legacyContent);
        const legacyDetails = await statLockFile(legacyLockPath);
        const legacyStale = legacyOwner
          ? !processIsAlive(legacyOwner.pid)
          : legacyDetails !== undefined && Date.now() - legacyDetails.mtimeMs > 5_000;
        if (legacyStale && legacyDetails) {
          const quarantine = `${legacyLockPath}.quarantine-${token}`;
          if (!await moveLockFile(legacyLockPath, quarantine)) continue;
          const movedContent = await readLockFile(quarantine, true);
          if (movedContent === undefined) throw new Error(`RepoMemo could not verify a quarantined legacy lock for ${target}`);
          if (movedContent !== legacyContent) {
            const movedOwner = parseLockOwner(movedContent);
            const movedDetails = await statLockFile(quarantine);
            const movedStale = movedOwner ? !processIsAlive(movedOwner.pid) : movedDetails !== undefined && Date.now() - movedDetails.mtimeMs > 5_000;
            if (movedStale) await removeLockFile(quarantine);
            else await restoreLockWithoutOverwrite(quarantine, legacyLockPath);
            throw new Error(`RepoMemo legacy lock changed while stale ownership was being reclaimed for ${target}`);
          }
          await removeLockFile(quarantine);
          continue;
        }
      }

      if (Date.now() >= deadline) throw new Error(`timed out waiting for another RepoMemo init on ${target}`);
      await new Promise((resolve) => setTimeout(resolve, 25 + Math.floor(Math.random() * 25)));
    }

    try {
      return await action();
    } finally {
      const releasePath = `${legacyLockPath}.release-${token}`;
      if (!await moveLockFile(legacyLockPath, releasePath)) throw new Error(`RepoMemo legacy lock disappeared before release for ${target}`);
      const releasedContent = await readLockFile(releasePath, true);
      if (releasedContent !== legacyOwnerContent) {
        await restoreLockWithoutOverwrite(releasePath, legacyLockPath);
        throw new Error(`RepoMemo legacy lock ownership changed before release for ${target}`);
      }
      await removeLockFile(releasePath);
    }
  } finally {
    const cleanup = await Promise.allSettled([choosingCandidatePath, choosingPath, candidatePath, contenderPath].map(removeLockFile));
    const failures = cleanup.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length > 0) throw new AggregateError(failures.map((result) => result.reason), `RepoMemo could not clean up its project lock for ${target}`);
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
