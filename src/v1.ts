import path from "node:path";
import { readText } from "./path-utils.js";

export async function detectV1(target: string): Promise<boolean> {
  const readme = await readText(path.join(target, ".ai", "README.md"));
  if (!readme || !/Shared Project Memory/iu.test(readme)) return false;
  let knownCount = 0;
  for (const name of ["project.md", "memory.md", "handoff.md"]) {
    if ((await readText(path.join(target, ".ai", name))) !== undefined) knownCount += 1;
  }
  if (knownCount < 2) return false;
  for (const adapter of ["AGENTS.md", "CLAUDE.md", "opencode.md"]) {
    const content = await readText(path.join(target, adapter));
    if (content?.includes(".ai/README.md")) return true;
  }
  return false;
}
