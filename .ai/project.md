# Project

## What This Project Is

`repomemo` is a small CLI tool that drops a shared, version-controlled AI
project memory into any repository. Running `repomemo init` creates a `.ai/`
directory and three thin root adapter files so any AI coding agent that
respects `CLAUDE.md`, `AGENTS.md`, or `opencode.md` reads the same project
facts in the same order at session start.

## Main Layout

```
repomemo/
├── bin/repomemo          # Bash CLI (the tool itself)
├── templates/            # what `repomemo init` writes into user repos
│   ├── .ai/              # 4 markdown files + 3 root adapters
│   ├── CLAUDE.md
│   ├── AGENTS.md
│   └── opencode.md
├── tests/                # integration test suite
├── homebrew/             # Homebrew formula (reference copy)
├── install.sh            # curl one-liner installer
├── package.json          # npm wrapper
├── README.md / README.zh.md  # human-facing docs
└── .github/workflows/    # CI / release automation
```

## Stack

- **Bash** (3.2+) for the CLI. No compiler, no language runtime, no build step.
- **Markdown** for the scaffold and docs.
- **Git** + **GitHub** for versioning, hosting, releases, Actions.
- **Homebrew**, **curl-pipe-bash**, and **npm** as parallel distribution channels.

## Standard Workflow

```
edit bin/repomemo or templates/
  → bash -n bin/repomemo
  → bash tests/test_repomemo.sh
  → bash bin/repomemo check --strict .
  → git add, commit, push
  → tag vX.Y.Z → GitHub Action publishes release
  → update homebrew tap with new SHA256
```

## Done Criteria

A change is done when:

1. `bash -n bin/repomemo` passes.
2. `bash tests/test_repomemo.sh` passes (all tests, 0 failures).
3. `bash bin/repomemo check --strict .` passes.
4. `bash bin/repomemo check --verify .` passes (adapters match templates,
   memory files are customized, no-private-memory instruction present).
5. `.ai/handoff.md` was updated before the task was reported as done.
6. If stable knowledge emerged, `.ai/memory.md` was updated.
7. No secrets, tokens, or private hostnames were committed.
8. `CLAUDE.md`, `AGENTS.md`, and `opencode.md` list the same `.ai/` files
   in the same order.
9. `README.md` and `README.zh.md` stay mirrored.
10. `templates/` files match `SCAFFOLD_FILES` in `bin/repomemo`.

## Distribution

- **Homebrew**: `brew tap SUN-1024/repomemo && brew install repomemo`
  Tap repo: `SUN-1024/homebrew-repomemo`
- **Curl**: `curl -fsSL .../install.sh | bash`
- **npm**: `npm install -g repomemo` (package name is `repomemo`)
- **Source**: `git clone` + symlink `bin/repomemo` onto `$PATH`

Releases are triggered by pushing a `v*.*.*` tag. Bumping a version touches:
`bin/repomemo` (`VERSION=`), `homebrew/repomemo.rb`, `package.json`,
`tests/test_repomemo.sh` (`EXPECTED_VERSION`), plus a new git tag.
