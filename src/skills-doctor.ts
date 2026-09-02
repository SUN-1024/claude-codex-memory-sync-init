import { readdir } from "node:fs/promises";
import path from "node:path";
import { NonUtf8TextError, pathKind, readText } from "./path-utils.js";
import type { Finding } from "./types.js";

interface ParsedSkill {
  name: string;
  description: string;
}

function finding(code: string, severity: Finding["severity"], message: string, filePath: string): Finding {
  return { code, severity, message, repairable: false, path: filePath };
}

function scalar(frontmatter: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`^${escaped}:[ \\t]*(.+?)[ \\t]*$`, "mu").exec(frontmatter)?.[1];
  if (!match) return undefined;
  if ((match.startsWith('"') && match.endsWith('"')) || (match.startsWith("'") && match.endsWith("'"))) return match.slice(1, -1).trim();
  return match.trim();
}

function parseMinimalFrontmatter(content: string): ParsedSkill | undefined {
  const lines = content.split(/\r?\n/u);
  if (lines[0] !== "---") return undefined;
  const closing = lines.indexOf("---", 1);
  if (closing === -1) return undefined;
  const frontmatter = lines.slice(1, closing).join("\n");
  const name = scalar(frontmatter, "name");
  const description = scalar(frontmatter, "description");
  if (!name || !description) return undefined;
  return { name, description };
}

export async function inspectSkills(target: string): Promise<Finding[]> {
  const root = path.join(target, ".agents", "skills");
  if (await pathKind(root) !== "directory") return [];
  const findings: Finding[] = [];
  const names = new Map<string, string>();

  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === "README.md") continue;
    const relative = `.agents/skills/${entry.name}`;
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      findings.push(finding("SKILL_DIRECTORY_INVALID", "error", `${relative} must be a real directory containing SKILL.md for portable discovery.`, relative));
      continue;
    }
    if (entry.name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entry.name)) {
      findings.push(finding("SKILL_DIRECTORY_NAME_INVALID", "error", `${relative} must use a portable lowercase hyphenated name of at most 64 characters.`, relative));
    }

    const skillRelative = `${relative}/SKILL.md`;
    const skillPath = path.join(root, entry.name, "SKILL.md");
    if (await pathKind(skillPath) !== "file") {
      findings.push(finding("SKILL_FILE_MISSING", "error", `${skillRelative} is missing or is not a regular file.`, skillRelative));
      continue;
    }

    let content: string | undefined;
    try {
      content = await readText(skillPath);
    } catch (error) {
      if (error instanceof NonUtf8TextError) findings.push(finding("SKILL_NON_UTF8", "error", `${skillRelative} is not valid UTF-8.`, skillRelative));
      else throw error;
      continue;
    }
    const parsed = parseMinimalFrontmatter(content ?? "");
    if (!parsed) {
      findings.push(finding("SKILL_FRONTMATTER_INVALID", "error", `${skillRelative} needs YAML frontmatter with non-empty name and description fields.`, skillRelative));
      continue;
    }
    if (parsed.name !== entry.name) {
      findings.push(finding("SKILL_NAME_MISMATCH", "error", `${skillRelative} declares name '${parsed.name}', which must match directory '${entry.name}' for portable discovery.`, skillRelative));
    }
    if (!/[>|]/u.test(parsed.description) && parsed.description.length > 1024) {
      findings.push(finding("SKILL_DESCRIPTION_TOO_LONG", "error", `${skillRelative} description exceeds the portable 1024-character limit.`, skillRelative));
    }
    const normalized = parsed.name.normalize("NFKC").toLocaleLowerCase("en-US");
    const previous = names.get(normalized);
    if (previous) {
      findings.push(finding("SKILL_NAME_DUPLICATE", "error", `${skillRelative} duplicates the portable Skill name declared by ${previous}.`, skillRelative));
    } else names.set(normalized, skillRelative);
  }
  return findings;
}
