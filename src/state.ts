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
  const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
  if (!updated || !rfc3339.test(updated) || Number.isNaN(Date.parse(updated))) findings.push(finding("STATE_UPDATED_INVALID", "error", "Updated must be a valid RFC 3339 timestamp."));

  const lastHarness = field(content, "Last Harness");
  if (!lastHarness || !/^[a-z0-9][a-z0-9._-]*$/u.test(lastHarness)) findings.push(finding("STATE_HARNESS_INVALID", "error", "Last Harness must be a lowercase harness identifier or unknown."));
  else if (lastHarness !== "unknown" && !hasAdapter(lastHarness)) findings.push(finding("STATE_HARNESS_UNKNOWN", "warning", `Last Harness is not in the adapter registry: ${lastHarness}`));

  const scope = field(content, "Scope");
  if (!scope || !isProjectRelative(scope)) findings.push(finding("STATE_SCOPE_INVALID", "error", "Scope must be a project-relative path that does not escape the target."));

  for (const section of STATE_SECTIONS) {
    const count = lineCount(content, `## ${section}`);
    if (count !== 1) findings.push(finding("STATE_SECTION_INVALID", "error", `Expected exactly one section: ${section}.`));
  }

  if (
    status === "idle"
    && sectionBody(content, "Goal") === "No active task."
    && sectionBody(content, "Next Action") === "Start the next task from the current filesystem state."
  ) {
    findings.push(finding(
      "STATE_BOOTSTRAP_PLACEHOLDER",
      "warning",
      "AGENT_STATE.md still contains the bootstrap placeholder; record current progress before switching Harnesses."
    ));
  }

  const touched = /## Touched Paths\s*([\s\S]*?)(?=\n## |$)/u.exec(content)?.[1] ?? "";
  for (const match of touched.matchAll(/`([^`]+)`/gu)) {
    const candidate = match[1];
    if (candidate && !isProjectRelative(candidate)) findings.push(finding("STATE_TOUCHED_PATH_ESCAPE", "error", `Touched path escapes the project: ${candidate}`));
  }

  if (/(ignore|disregard)\s+(all|any|the|previous).*instructions|override\s+AGENTS\.md|system\s*prompt/iu.test(content)) findings.push(finding("STATE_INSTRUCTION_LIKE_TEXT", "warning", "State contains instruction-like override text; treat it only as advisory data."));
  return findings;
}
