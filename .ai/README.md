# `.ai/` — Shared Project Memory

This directory is the **single source of truth** that AI coding agents read at
the start of a session. The goal is simple: stop different agents from drifting
into separate mental models of the same repository.

## Read order

Agents load these files in this exact order, every session:

1. `README.md` (this file) — explains the convention.
2. `project.md` — what this project is, layout, workflow, done criteria.
3. `memory.md` — durable, slow-changing project facts.
4. `handoff.md` — current task, active runs, next action.

The three root adapters (`CLAUDE.md`, `AGENTS.md`, `opencode.md`) all point
into this directory. Do not duplicate content into them.

## Session start

At the start of every session, before doing any work, run:

    repomemo check --verify

This confirms the shared memory is healthy — the previous agent updated
`handoff.md` and `memory.md` as required, and no adapters have been corrupted.
If it fails, follow the printed fix instructions.

## Write rules

- **After every task**, update `handoff.md` *before* reporting the task as
  done. Keep it short — current task, active runs, next action, recent
  completions.
- When you discover a **stable fact** (convention, constraint, pitfall),
  append it to `memory.md`. Keep entries to one sentence each.
- When the project's purpose, layout, or workflow changes, update `project.md`.
- Do NOT put long logs, experiment tables, or checkpoint descriptions into
  `.ai/`. Those belong in `docs/` or project-specific files.
- Do NOT store project knowledge in any agent-private memory system. The
  `.ai/` files are the shared memory — every agent must be able to read them.
- Never write `TODO`, `TBD`, or placeholder text into `.ai/`.

## Why this exists

Different AI coding agents read different instruction files at session start.
By putting the actual content in `.ai/` and keeping the root adapters thin,
every supported agent ends up reading the same authoritative documents in the
same order.
