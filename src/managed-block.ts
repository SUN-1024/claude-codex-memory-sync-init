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

export function hasAgentsImport(content: string): boolean {
  return content.split(/\r?\n/u).some((line) => {
    const normalized = line.trim();
    return normalized === "@AGENTS.md" || normalized === "@./AGENTS.md";
  });
}
