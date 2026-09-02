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

function quotedScalar(raw: string, quote: "'" | '"'): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(quote)) return undefined;
  let value = "";
  for (let index = 1; index < trimmed.length; index += 1) {
    const character = trimmed[index] ?? "";
    if (quote === "'" && character === "'" && trimmed[index + 1] === "'") {
      value += "'";
      index += 1;
      continue;
    }
    if (character === quote) {
      if (!/^[ \t]*(?:#.*)?$/u.test(trimmed.slice(index + 1))) return undefined;
      const result = value.trim();
      return result || undefined;
    }
    if (quote === '"' && character === "\\") {
      const escaped = trimmed[index + 1];
      if (!escaped) return undefined;
      const simple: Record<string, string> = {
        "0": "\0", a: "\u0007", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r",
        e: "\u001b", " ": " ", '"': '"', "/": "/", "\\": "\\", N: "\u0085", _: "\u00a0", L: "\u2028", P: "\u2029"
      };
      if (simple[escaped] !== undefined) {
        value += simple[escaped];
        index += 1;
        continue;
      }
      const widths: Record<string, number> = { x: 2, u: 4, U: 8 };
      const width = widths[escaped];
      if (!width) return undefined;
      const digits = trimmed.slice(index + 2, index + 2 + width);
      if (digits.length !== width || !/^[0-9A-Fa-f]+$/u.test(digits)) return undefined;
      const codePoint = Number.parseInt(digits, 16);
      if (codePoint > 0x10ffff) return undefined;
      value += String.fromCodePoint(codePoint);
      index += 1 + width;
      continue;
    }
    value += character;
  }
  return undefined;
}

function stringScalar(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"')) return quotedScalar(trimmed, '"');
  if (trimmed.startsWith("'")) return quotedScalar(trimmed, "'");
  const withoutComment = trimmed.replace(/[ \t]+#.*$/u, "").trim();
  if (
    !withoutComment
    || /^[\[\]{}&*!]/u.test(withoutComment)
    || /:[ \t]/u.test(withoutComment)
    || /^(?:~|null|true|false|[-+]?\.(?:inf|nan))$/iu.test(withoutComment)
    || /^[-+]?(?:(?:0|[1-9][0-9_]*)(?:\.[0-9_]*)?|\.[0-9_]+)(?:e[-+]?[0-9]+)?$/iu.test(withoutComment)
    || /^0(?:b[01_]+|o[0-7_]+|x[0-9a-f_]+)$/iu.test(withoutComment)
  ) return undefined;
  return withoutComment;
}

function frontmatterField(lines: string[], key: string): string | undefined {
  const pattern = new RegExp(`^${key}:[ \\t]*(.*)$`, "u");
  const matches = lines.flatMap((line, index) => {
    const match = pattern.exec(line);
    return match?.[1] !== undefined ? [{ index, raw: match[1] }] : [];
  });
  if (matches.length !== 1) return undefined;
  const match = matches[0];
  if (!match) return undefined;
  const blockHeader = /^[>|](?:[+-]?[1-9]?|[1-9]?[+-]?)(?:[ \t]+#.*)?$/u;
  if (!blockHeader.test(match.raw.trim())) return stringScalar(match.raw);

  const body: string[] = [];
  for (let index = match.index + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() && !/^[ \t]/u.test(line)) break;
    body.push(line);
  }
  const indents = body
    .filter((line) => line.trim())
    .map((line) => /^[ \t]*/u.exec(line)?.[0].length ?? 0);
  if (indents.length === 0) return undefined;
  const indent = Math.min(...indents);
  const normalized = body.map((line) => line.slice(Math.min(indent, line.length)));
  const value = match.raw.trim().startsWith(">")
    ? normalized.join("\n").replace(/([^\n])\n(?=[^\n])/gu, "$1 ").trim()
    : normalized.join("\n").trim();
  return value || undefined;
}

function parseMinimalFrontmatter(content: string): ParsedSkill | undefined {
  const lines = content.split(/\r?\n/u);
  if (lines[0] !== "---") return undefined;
  const closing = lines.indexOf("---", 1);
  if (closing === -1) return undefined;
  const frontmatter = lines.slice(1, closing);
  const name = frontmatterField(frontmatter, "name");
  const description = frontmatterField(frontmatter, "description");
  if (!name || !description) return undefined;
  return { name, description };
}

export async function inspectSkillRoot(root: string, relativeRoot: string): Promise<Finding[]> {
  if (await pathKind(root) !== "directory") return [];
  const findings: Finding[] = [];
  const names = new Map<string, string>();

  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = `${relativeRoot}/${entry.name}`;
    if (entry.name === "README.md") {
      if (!entry.isFile() || entry.isSymbolicLink()) findings.push(finding("SKILLS_README_CONFLICT", "error", `${relative} must be a regular file when present.`, relative));
      continue;
    }
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
    if (parsed.description.length > 1024) {
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

export async function inspectSkills(target: string): Promise<Finding[]> {
  return inspectSkillRoot(path.join(target, ".agents", "skills"), ".agents/skills");
}
