# RepoMemo

> **Languages:** **English** · [简体中文](./README.zh.md)

**One project. Any coding agent. No switching ceremony.**

RepoMemo is a minimal, Git-neutral continuity layer for agent-native project
directories. It bootstraps one portable file contract; after that, switch
between coding Harnesses directly without running convert, sync, generate,
export, or handoff commands.

## Quick start

```bash
cd my-project
npx repomemo@latest init

# Switch directly after the one-time bootstrap
codex
claude
gemini
opencode
```

`npx @latest` may need the network to obtain RepoMemo. Once the CLI is locally
available, `init` and `doctor` make no network calls.

## The contract

```text
my-project/
├── AGENTS.md              # permanent governance; canonical rules
├── AGENT_STATE.md         # advisory current-task and handoff data
├── .agents/
│   └── skills/            # canonical Agent Skills
├── CLAUDE.md              # thin @AGENTS.md bridge
├── GEMINI.md              # thin @AGENTS.md bridge
├── .claude/skills         # link to .agents/skills when available
└── .zcode/skills          # link to .agents/skills when available
```

The three planes are intentionally separate:

- **Governance:** `AGENTS.md` and `.agents/skills`.
- **Continuity:** `AGENT_STATE.md`.
- **Compatibility:** tiny imports and in-project links only where required.

RepoMemo manages only explicit HTML-comment blocks. User-authored text outside
those blocks is preserved. Ambiguous, duplicate, or malformed markers fail
closed instead of being guessed or overwritten.

## Commands

```bash
repomemo init [--target DIR] [--dry-run]
repomemo doctor [--target DIR] [--harness ID] [--json]
repomemo doctor --repair [--target DIR] [--harness ID] [--json]
```

- `init` uses exactly the supplied directory or current directory. It never
  searches for a Git root and requires the target directory to exist.
- `doctor` is read-only by default. It checks the contract, state schema,
  bridges, links, nested/ancestor instructions, and compatibility evidence.
- `doctor --repair` repairs only canonical managed blocks and safe links. It
  never rewrites `AGENT_STATE.md` or foreign content.

RepoMemo never runs Git, initializes a repository, edits `.gitignore`, invokes
the network, or executes scripts found in Skills.

## State is data, not authority

`AGENT_STATE.md` has a fixed Markdown schema with `idle`, `active`, `blocked`,
or `done` status plus goal, completed work, decisions, failures, touched paths,
validation, and next action. Paths are project-relative.

The current filesystem and authoritative project documentation win over stale
state. `AGENTS.md` wins over state on governance conflicts. A single writer per
working directory is an operating assumption, not a lock or concurrency
guarantee.

## Harness compatibility

Compatibility and evidence are separate. `native` means the Harness reads the
canonical path itself; `bridge` means a pointer/import/link is required;
`manual` means the Harness must follow the `AGENTS.md` instruction; and
`unsupported` means RepoMemo has no safe route. Evidence stays `official` or
`source-verified` until a real versioned Harness smoke test is recorded—no
unverified green checks.

<!-- repomemo:matrix:start -->
| Harness | Rules | Skills | Evidence |
|---|---|---|---|
| Codex | native | native | official |
| Claude Code | bridge | bridge | official |
| Gemini CLI | bridge | native | official |
| OpenCode | native | native | official |
| Cursor | native | native | official |
| GitHub Copilot CLI | native | native | official |
| ZCode | native | bridge | official |
| DeepSeek Harness | native | native | source-verified |
<!-- repomemo:matrix:end -->

The registry records official documentation, verification date, paths, and
mechanisms. RepoMemo does not convert MCP, hooks, permissions, commands, or
Harness-specific configuration.

## Git-neutral, not root-neutral

RepoMemo behaves the same in a plain directory and a Git working tree and never
calls Git. Individual Harnesses may still use `.git` or other markers to choose
their project root. `doctor` reports nearby root/instruction files so that this
difference is visible rather than hidden.

Bootstrap each working copy once. Symlinks and Windows junctions are local
filesystem details and should not be treated as portable session state.

## Install

```bash
# No global install
npx repomemo@latest init

# Global npm install
npm install --global repomemo

# Homebrew
brew tap SUN-1024/repomemo
brew install repomemo
```

Node.js 22 or newer is required. RepoMemo has zero runtime dependencies.

## v1 users

Version 2 is a deliberate clean break. It does not automatically transform
`.ai/` memory into the new contract. Follow [MIGRATION-v1-v2.md](./MIGRATION-v1-v2.md)
to review and move useful knowledge manually. v1 tags and the `v1` branch
remain available.

## Development

```bash
pnpm install
pnpm verify
pnpm pack --pack-destination artifacts
pnpm package:smoke artifacts/repomemo-2.0.0.tgz
```

See [CONTRIBUTING.md](./CONTRIBUTING.md). CI covers macOS, Linux, Windows, and
Node.js 22/24.

## License

MIT
