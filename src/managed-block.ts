export interface BlockMarkers {
  start: string;
  end: string;
}

export type BlockInspection =
  | { kind: "absent" }
  | { kind: "malformed"; reason: string }
  | { kind: "valid"; startIndex: number; endIndex: number; text: string };

export interface BlockApplication {
  kind: "created" | "updated" | "unchanged" | "malformed";
  content: string;
  reason?: string;
  managed: boolean;
}

function occurrences(content: string, needle: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = content.indexOf(needle, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + needle.length;
  }
}

export function detectEol(content: string): "\n" | "\r\n" {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

export function inspectManagedBlock(content: string, markers: BlockMarkers): BlockInspection {
  const starts = occurrences(content, markers.start);
  const ends = occurrences(content, markers.end);
  if (starts === 0 && ends === 0) return { kind: "absent" };
  if (starts !== 1 || ends !== 1) return { kind: "malformed", reason: `expected one start and one end marker, found ${starts}/${ends}` };
  const startIndex = content.indexOf(markers.start);
  const markerEndIndex = content.indexOf(markers.end);
  if (markerEndIndex < startIndex) return { kind: "malformed", reason: "end marker appears before start marker" };
  const endIndex = markerEndIndex + markers.end.length;
  const bodyStart = startIndex + markers.start.length;
  const body = content.slice(bodyStart, markerEndIndex);
  if (/<!--\s*repomemo:[\s\S]*?-->/u.test(body)) {
    return { kind: "malformed", reason: "nested RepoMemo marker inside managed block" };
  }
  return { kind: "valid", startIndex, endIndex, text: content.slice(startIndex, endIndex) };
}

function withEol(block: string, eol: string): string {
  return block.replaceAll("\n", eol);
}

export function applyManagedBlock(
  existing: string | undefined,
  canonicalBlock: string,
  markers: BlockMarkers,
  equivalent?: (content: string) => boolean
): BlockApplication {
  if (existing === undefined) return { kind: "created", content: `${canonicalBlock}\n`, managed: true };
  const inspection = inspectManagedBlock(existing, markers);
  if (inspection.kind === "malformed") return { kind: "malformed", content: existing, reason: inspection.reason, managed: false };
  if (inspection.kind === "absent") {
    if (equivalent?.(existing)) return { kind: "unchanged", content: existing, managed: false };
    const eol = detectEol(existing);
    const separator = existing.length === 0 ? "" : existing.endsWith(eol) ? eol : `${eol}${eol}`;
    return {
      kind: existing.length === 0 ? "created" : "updated",
      content: `${existing}${separator}${withEol(canonicalBlock, eol)}${eol}`,
      managed: true
    };
  }
  const eol = detectEol(existing);
  const replacement = withEol(canonicalBlock, eol);
  const content = `${existing.slice(0, inspection.startIndex)}${replacement}${existing.slice(inspection.endIndex)}`;
  return { kind: content === existing ? "unchanged" : "updated", content, managed: true };
}

function stripInlineCode(line: string): string {
  let output = "";
  let index = 0;
  while (index < line.length) {
    if (line[index] !== "`") {
      output += line[index];
      index += 1;
      continue;
    }
    let markerEnd = index;
    while (line[markerEnd] === "`") markerEnd += 1;
    const marker = line.slice(index, markerEnd);
    const closing = line.indexOf(marker, markerEnd);
    if (closing === -1) {
      output += line.slice(index);
      break;
    }
    output += " ".repeat(closing + marker.length - index);
    index = closing + marker.length;
  }
  return output;
}

function markdownOutsideCode(content: string): string {
  const output: string[] = [];
  let fence: { character: "`" | "~"; length: number } | undefined;
  for (const line of content.split(/\r?\n/u)) {
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`, "u");
      if (closing.test(line)) fence = undefined;
      output.push("");
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})/u.exec(line);
    if (opening?.[1]) {
      fence = { character: opening[1][0] as "`" | "~", length: opening[1].length };
      output.push("");
      continue;
    }
    output.push(stripInlineCode(line));
  }
  return output.join("\n");
}

function hasMarkdownAgentsImport(content: string): boolean {
  const prose = markdownOutsideCode(content);
  return /(^|[\s([{:<>\-])@(?:\.\/)?AGENTS\.md(?=$|[\s,;:!?)}\]'">]|\.(?![A-Za-z0-9_-]))/mu.test(prose);
}

export function hasClaudeAgentsImport(content: string): boolean {
  return hasMarkdownAgentsImport(content);
}

export function hasGeminiAgentsImport(content: string): boolean {
  return hasMarkdownAgentsImport(content);
}
