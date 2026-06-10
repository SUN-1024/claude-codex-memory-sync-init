# Definition of Done

repomemo is a Bash script plus a markdown scaffold. "Done" is therefore
defined in terms of script correctness, scaffold completeness, and
documentation consistency.

## Required commands

Run from the repository root. All commands must succeed before a change is
considered done.

- **Smoke test the CLI**: `bash bin/repomemo --version` and `bash bin/repomemo --help`.
- **Run the integration test suite**: `bash tests/test_repomemo.sh`.
- **Self-check**: `bash bin/repomemo check .` and
  `bash bin/repomemo check --strict .` (repomemo's own `.ai/`, root adapters,
  and templates must pass).

There is no compiler, linter, formatter, or typechecker configured for this
repository. Any change to that decision should be documented here in the
same commit.

## A change is "done" when

1. **Every required command above passes locally.**
2. **All seven `.ai/` files exist and are non-empty.**
3. **The three root adapters stay in sync.**
   - `CLAUDE.md` lists every `.ai/` file via `@./path` imports in the read
     order defined by `.ai/README.md`.
   - `AGENTS.md` lists the same files in the same order, plus the post-task
     update rule.
   - `opencode.md` lists every `.ai/` file via `@./path` imports in the read
     order defined by `.ai/README.md`.
4. **The two root READMEs stay mirrored.**
   - `README.md` (English) and `README.zh.md` (Simplified Chinese) cover the
     same ground; whichever was edited, the other is updated in the same
     change.
5. **`templates/` files match `.ai/` semantics.** When the scaffold gains or
   loses a file, `templates/`, the file lists in `bin/repomemo`
   (`SCAFFOLD_FILES`), `CLAUDE.md`, `AGENTS.md`, and `opencode.md` are
   updated together.
6. **`bin/repomemo` is executable** (`chmod +x`) and committed with mode
   `100755`.
7. **`.ai/handoff.md` reflects the change just made** before the task is
   reported as done.
8. **No placeholder text** (`TODO`, `TBD`, `<placeholder>`, `XXX`,
   `Lorem ipsum`) inside `.ai/`. If a fact is genuinely undefined, the file
   says so in one clear sentence.
9. **`LICENSE` is present and unmodified** unless the change is licensing
   itself.
10. **No secrets, tokens, or private URLs** committed anywhere.
11. **No new contributor language** that names a single AI agent as author,
    maintainer, or owner.

## Review expectations

- Diffs touching `.ai/architecture.md` or `.ai/project.md` are
  cross-checked against the actual repo state — these files describe the
  repository and must not lie.
- Diffs touching `bin/repomemo` are reviewed alongside `tests/test_repomemo.sh`
  — new behavior gets a test.
- Diffs touching `CLAUDE.md`, `AGENTS.md`, `opencode.md`,
  `templates/CLAUDE.md`, `templates/AGENTS.md`, or `templates/opencode.md`
  land **together** when the read order or file list changes.
- Diffs touching `homebrew/repomemo.rb` reference a real release tag and
  SHA256 once the tag exists; placeholder SHA256 values are flagged.

## Verification

- `bash tests/test_repomemo.sh` exits 0.
- `bash bin/repomemo check .` exits 0.
- `bash bin/repomemo check --strict .` exits 0.
- `git status` is clean before opening the PR.
