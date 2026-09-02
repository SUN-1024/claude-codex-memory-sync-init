import { hasAdapter } from "./adapters.js";
import { STATE_MARKER, STATE_SECTIONS } from "./constants.js";
import { isProjectRelative } from "./path-utils.js";
import type { Finding } from "./types.js";

export function createState(now = new Date()): string {
  return `${STATE_MARKER}
# Agent State

- Status: idle
- Updated: ${now.toISOString()}
- Last Harness: unknown
- Scope: .

## Goal

No active task.

## Completed

- None.

## Decisions

- None.

## Failed Attempts

- None.

## Touched Paths

- None.

## Validation

- Not run.

## Next Action

Start the next task from the current filesystem state.
`;
}

function field(content: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^- ${escaped}:[ \\t]*([^\\r\\n]+)$`, "mu").exec(content)?.[1]?.trim();
}

function lineCount(content: string, line: string): number {
  return content.split(/\r?\n/u).filter((candidate) => candidate === line).length;
}

function fieldCount(content: string, name: string): number {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return [...content.matchAll(new RegExp(`^- ${escaped}:`, "gmu"))].length;
}

function finding(code: string, severity: Finding["severity"], message: string): Finding {
  return { code, severity, message, path: "AGENT_STATE.md", repairable: false };
}

function sectionBody(content: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^## ${escaped}[ \\t]*\\r?\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu").exec(content)?.[1]?.trim();
}

function isValidRfc3339(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[10] ?? 0);
  const offsetMinute = Number(match[11] ?? 0);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth && !Number.isNaN(Date.parse(value));
}

export function validateState(content: string): Finding[] {
  const findings: Finding[] = [];
  const markerCount = content.split(STATE_MARKER).length - 1;
  if (markerCount !== 1 || !content.trimStart().startsWith(STATE_MARKER)) findings.push(finding("STATE_MARKER_INVALID", "error", "AGENT_STATE.md must begin with exactly one repomemo-state:v1 marker."));

  for (const name of ["Status", "Updated", "Last Harness", "Scope"]) {
    if (fieldCount(content, name) !== 1) {
      findings.push(finding("STATE_FIELD_INVALID", "error", `Expected exactly one ${name} field.`));
    }
  }

  const status = field(content, "Status");
  if (!status || !["idle", "active", "blocked", "done"].includes(status)) findings.push(finding("STATE_STATUS_INVALID", "error", "Status must be idle, active, blocked, or done."));

  const updated = field(content, "Updated");
  if (!updated || !isValidRfc3339(updated)) findings.push(finding("STATE_UPDATED_INVALID", "error", "Updated must be a real calendar date and valid RFC 3339 timestamp."));

  const lastHarness = field(content, "Last Harness");
  if (!lastHarness || !/^[a-z0-9][a-z0-9._-]*$/u.test(lastHarness)) findings.push(finding("STATE_HARNESS_INVALID", "error", "Last Harness must be a lowercase harness identifier or unknown."));
  else if (lastHarness !== "unknown" && !hasAdapter(lastHarness)) findings.push(finding("STATE_HARNESS_UNKNOWN", "warning", `Last Harness is not in the adapter registry: ${lastHarness}`));

  const scope = field(content, "Scope");
  if (!scope || !isProjectRelative(scope)) findings.push(finding("STATE_SCOPE_INVALID", "error", "Scope must be a project-relative path that does not escape the target."));

  for (const section of STATE_SECTIONS) {
    const count = lineCount(content, `## ${section}`);
    if (count !== 1) findings.push(finding("STATE_SECTION_INVALID", "error", `Expected exactly one section: ${section}.`));
  }

  const bootstrapSections = [
    ["Goal", "No active task."],
    ["Completed", "- None."],
    ["Decisions", "- None."],
    ["Failed Attempts", "- None."],
    ["Touched Paths", "- None."],
    ["Validation", "- Not run."],
    ["Next Action", "Start the next task from the current filesystem state."]
  ] as const;
  const unchangedBootstrap = bootstrapSections.filter(([name, placeholder]) => sectionBody(content, name) === placeholder);
  if (unchangedBootstrap.length > 0) {
    findings.push(finding(
      "STATE_BOOTSTRAP_PLACEHOLDER",
      "warning",
      `AGENT_STATE.md still contains bootstrap text in: ${unchangedBootstrap.map(([name]) => name).join(", ")}. Record current progress before switching Harnesses.`
    ));
  }

  const touched = /## Touched Paths\s*([\s\S]*?)(?=\n## |$)/u.exec(content)?.[1] ?? "";
  const candidates = new Set<string>();
  for (const match of touched.matchAll(/`([^`]+)`/gu)) {
    const candidate = match[1];
    if (candidate) candidates.add(candidate);
  }
  for (const line of touched.split(/\r?\n/u)) {
    const bullet = /^[ \t]*-[ \t]+(.+?)[ \t]*$/u.exec(line)?.[1];
    if (!bullet || bullet === "None." || bullet.includes("`") || /\s/u.test(bullet)) continue;
    candidates.add(bullet.replace(/[.,;:]$/u, ""));
  }
  for (const candidate of candidates) {
    if (!isProjectRelative(candidate)) findings.push(finding("STATE_TOUCHED_PATH_ESCAPE", "error", `Touched path escapes the project: ${candidate}`));
  }

  if (/(ignore|disregard)\s+(all|any|the|previous).*instructions|override\s+AGENTS\.md|system\s*prompt/iu.test(content)) findings.push(finding("STATE_INSTRUCTION_LIKE_TEXT", "warning", "State contains instruction-like override text; treat it only as advisory data."));
  return findings;
}
