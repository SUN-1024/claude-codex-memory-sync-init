#!/usr/bin/env node
import { getAdapter } from "./adapters.js";
import { VERSION } from "./constants.js";
import { runDoctor } from "./doctor.js";
import { runInit } from "./init.js";
import { resolveTarget } from "./path-utils.js";
import { CliUsageError, type DoctorReport } from "./types.js";

const HELP = `repomemo ${VERSION} — Git-neutral continuity for agent-native projects

USAGE
  repomemo init [--target DIR] [--dry-run]
  repomemo doctor [--target DIR] [--harness ID] [--json]
  repomemo doctor --repair [--target DIR] [--harness ID] [--json]
  repomemo --help
  repomemo --version

COMMANDS
  init     Bootstrap the portable repository contract. Never searches for a Git root.
  doctor   Read-only validation by default; --repair fixes only safe managed bridges and links.

RepoMemo never runs Git, accesses the network, or executes Skill scripts.
`;

interface CommonFlags {
  target?: string;
  harness?: string;
  json: boolean;
  repair: boolean;
  dryRun: boolean;
}

function parseFlags(args: string[], command: "init" | "doctor"): CommonFlags {
  const result: CommonFlags = { json: false, repair: false, dryRun: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--target") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new CliUsageError("--target requires a directory");
      result.target = value;
      index += 1;
    } else if (argument === "--dry-run" && command === "init") result.dryRun = true;
    else if (argument === "--json" && command === "doctor") result.json = true;
    else if (argument === "--repair" && command === "doctor") result.repair = true;
    else if (argument === "--harness" && command === "doctor") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new CliUsageError("--harness requires an adapter id");
      if (!getAdapter(value)) throw new CliUsageError(`unknown harness: ${value}`);
      result.harness = value;
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      process.stdout.write(HELP);
      process.exit(0);
    } else throw new CliUsageError(`unknown option for ${command}: ${argument ?? ""}`);
  }
  return result;
}

function printDoctor(report: DoctorReport): void {
  for (const finding of report.findings) {
    const location = finding.path ? ` ${finding.path}` : "";
    const harness = finding.harness ? ` [${finding.harness}]` : "";
    process.stdout.write(`${finding.severity.toUpperCase().padEnd(7)} ${finding.code}${harness}${location}: ${finding.message}\n`);
  }
  process.stdout.write("\nHarness support:\n");
  for (const adapter of report.support) process.stdout.write(`  ${adapter.id.padEnd(10)} rules=${adapter.rules.mode.padEnd(11)} skills=${adapter.skills.mode.padEnd(11)} evidence=${adapter.evidence.level}\n`);
  process.stdout.write(`\nRepoMemo doctor: ${report.healthy ? "healthy" : "issues found"}${report.changed ? " (repaired)" : ""}\n`);
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write(`repomemo ${VERSION}\n`);
    return 0;
  }
  if (command !== "init" && command !== "doctor") throw new CliUsageError(`unknown command: ${command}`);

  const flags = parseFlags(args, command);
  const target = await resolveTarget(flags.target);
  if (command === "init") {
    const result = await runInit(target, flags.dryRun);
    for (const change of result.changes) process.stdout.write(`${flags.dryRun ? "WOULD " : ""}${change}\n`);
    for (const finding of result.findings) process.stderr.write(`${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}\n`);
    const errors = result.findings.filter((finding) => finding.severity === "error").length;
    process.stdout.write(`RepoMemo init: ${errors > 0 ? "stopped" : flags.dryRun ? "dry run complete" : "complete"}; ${result.changes.length} change(s)${result.findings.length > 0 ? `, ${result.findings.length} finding(s)` : ""}.\n`);
    return errors > 0 ? 1 : 0;
  }

  const report = await runDoctor(target, { repair: flags.repair, ...(flags.harness ? { harness: flags.harness } : {}) });
  if (flags.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else printDoctor(report);
  return report.healthy ? 0 : 1;
}

main().then(
  (code) => { process.exitCode = code; },
  (error: unknown) => {
    if (error instanceof CliUsageError) {
      process.stderr.write(`repomemo: ${error.message}\n`);
      process.exitCode = 2;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`repomemo: ${message}\n`);
    if (process.env.REPOMEMO_DEBUG === "1" && error instanceof Error) process.stderr.write(`${error.stack ?? ""}\n`);
    process.exitCode = 1;
  }
);
