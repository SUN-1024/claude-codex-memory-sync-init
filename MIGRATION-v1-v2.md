# Migrating RepoMemo v1 to v2

RepoMemo 2 deliberately has no automatic `.ai/` converter. Migration is a
content review: decide what remains authoritative, move it to the project's
normal documentation, and discard stale memory rather than copying it forward.

## Before migrating

Keep a backup, branch, tag, or directory copy of the v1 working tree. RepoMemo
does not require Git, but it also does not provide rollback storage.

## Manual mapping

| v1 file | Review and move useful content to |
|---|---|
| `.ai/project.md` | Existing `README`, `CONTRIBUTING`, architecture, or workflow documentation |
| `.ai/memory.md` | The relevant durable project document or permanent rules in `AGENTS.md` |
| `.ai/handoff.md` | `AGENT_STATE.md` using the fixed v1 state schema |
| `.ai/README.md` | Usually discard; RepoMemo 2's contract replaces it |
| `opencode.md` | Usually remove; OpenCode reads `AGENTS.md` natively |

Then create or review:

```text
AGENTS.md
AGENT_STATE.md
.agents/skills/
CLAUDE.md
GEMINI.md
```

Skills must exist only in `.agents/skills`. Claude Code and ZCode may use links
from their native project paths; never copy the Skill directories.

After manually removing the confirmed v1 scaffold, run:

```bash
repomemo init
repomemo doctor
```

If `init` still reports `V1_SIGNATURE_DETECTED`, review the remaining `.ai/`
files and root adapters. RepoMemo will not delete or move them for you.
