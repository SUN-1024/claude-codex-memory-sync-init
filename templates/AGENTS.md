# AGENTS.md

Read these files in order before doing any work in this repository:

1. `.ai/README.md`
2. `.ai/project.md`
3. `.ai/memory.md`
4. `.ai/handoff.md`

These files are the shared source of truth for every AI coding agent that
respects this convention. Do not duplicate their content into this file or
anywhere else in the repo root.

## Update rule

After any task, update `.ai/handoff.md` **before** reporting the task as done.

If stable project knowledge is discovered during the task — a convention, a
constraint, a pitfall worth remembering across sessions — update
`.ai/memory.md` in the same change.

If the project's purpose, layout, or workflow changed, update `.ai/project.md`
directly so the next session sees the truth.

Do NOT store project knowledge in any agent-private memory system. Write it to
the `.ai/` files listed above so every agent (Claude Code, Codex, OpenCode) can
read it.

Never write `TODO`, `TBD`, or placeholder text into any `.ai/` file. If a fact
is genuinely undefined, write one clear sentence saying so.
