# RepoMemo

> **Languages:** **English** · [简体中文](./README.zh.md)

**Initialize once. Keep working. Switch Agent Harnesses without conversion.**

RepoMemo makes a new or already-in-progress project **Agent Native** and
**Harness Native**. It keeps durable rules, current progress, and reusable
Skills in the project itself, so Codex, Claude Code, Gemini CLI, OpenCode,
Cursor, Copilot CLI, ZCode, and DeepSeek Harness can work from the same sources.

## Start in 30 seconds

Run this once inside any new or existing project:

```bash
cd my-project
npx repomemo@latest init
```

Then open the same directory with any supported Harness:

```bash
codex
# or: claude, gemini, opencode, cursor, copilot, zcode, dsh
```

That is the whole switching workflow. There is no RepoMemo `switch`, `sync`,
`convert`, `export`, or `handoff` command.

## Already halfway through a project?

Run the same `init` command in the existing project directory. RepoMemo keeps
the source tree, configuration, user-written rules, current state, and existing
Skills. It adds only the shared contract and required compatibility bridges.

Before switching, ask the current agent to record the real progress:

```text
Read AGENTS.md and update AGENT_STATE.md with the current goal,
completed work, validation, changed paths, and next action.
```

The next Harness opens the same directory, reads `AGENTS.md` and
`AGENT_STATE.md`, and continues. A Harness that was already running may need to
reload the project files or start a new session. Private chat history is not
portable; important context must be written into the project.

## The idea

- **Agent Harness** is the runtime or interface hosting the coding agent, such
  as Codex, Claude Code, Gemini CLI, or OpenCode.
- **Agent Native** means the project is a first-class home for agent-readable
  rules, state, and Skills. The project—not a private chat—is the durable unit.
- **Harness Native** means each Harness uses paths and formats it already
  supports. RepoMemo prefers native discovery and adds only a tiny bridge when
  a Harness requires one.

The principle is simple: **the project owns continuity; Harnesses are
replaceable entry points.** RepoMemo is not an agent launcher, wrapper, session
manager, or new Harness.

## Only three commands

```bash
# Add or safely upgrade RepoMemo in this project
repomemo init

# Read-only diagnosis
repomemo doctor

# Repair only safe RepoMemo-managed bridges and links
repomemo repair
```

Useful forms:

```bash
repomemo init --target path/to/project
repomemo doctor --harness claude
repomemo doctor --json
repomemo repair --harness zcode
```

`doctor --repair` remains a compatibility alias for older scripts. A healthy
`doctor` report confirms the on-disk contract; it does not launch, authenticate,
upgrade, or approve workspace trust for a third-party Harness.

## Three shared sources

```text
my-project/
├── AGENTS.md              # durable project rules
├── AGENT_STATE.md         # current goal, progress, tests, and next action
├── .agents/skills/        # reusable Agent Skills
├── CLAUDE.md              # thin bridge when required
├── GEMINI.md              # thin bridge when required
├── .claude/skills         # link when supported
└── .zcode/skills          # link when supported
```

You maintain the first three sources. RepoMemo owns only clearly marked blocks
and safe compatibility links. Text outside managed markers is preserved;
malformed or ambiguous markers fail closed instead of being overwritten.

## Install

The recommended path needs no global installation:

```bash
npx repomemo@latest init
```

Optional permanent installation:

```bash
# npm
npm install --global repomemo

# Homebrew
brew tap SUN-1024/repomemo
brew install repomemo
```

RepoMemo requires Node.js 22 or newer and has zero runtime dependencies. The
first `npx` download needs network access; the installed CLI performs `init`,
`doctor`, and `repair` locally without Git or network calls.

## Upgrade without rebuilding the project

Run the latest `init` in the same working copy:

```bash
cd existing-project
npx repomemo@latest init
npx repomemo@latest doctor
```

Compatible upgrades update only RepoMemo-managed blocks and missing bridges.
They preserve source files, user-authored text, `AGENT_STATE.md`, and
`.agents/skills`. Repeating `init` should report `0 change(s)`.

## Harness compatibility

`native` means direct Harness support. `bridge` means RepoMemo adds a minimal
import or local link. The registry and both README matrices are generated from
[`data/harnesses.json`](./data/harnesses.json).

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

RepoMemo itself is Git-neutral. Some Harness versions may use `.git` or other
markers to choose a project root. In live tests, OpenCode discovered project
Skills natively in a Git worktree but not in a plain directory;
`doctor --harness opencode` reports that limitation. RepoMemo never runs
`git init` on the user's behalf.

## What RepoMemo deliberately does not do

- It does not copy or convert private chat sessions.
- It does not launch, install, authenticate, or configure Harnesses.
- It does not convert MCP, hooks, permissions, or Harness-private settings.
- It does not run Git, edit `.gitignore`, use the network, or execute Skill scripts.
- It never invents project progress or silently replace foreign content.

For the shortest walkthrough, see [RepoMemo in one minute](./QUICKSTART.md).
Version 1 users should read [MIGRATION-v1-v2.md](./MIGRATION-v1-v2.md).

## Development

```bash
pnpm install
pnpm verify
pnpm pack --pack-destination artifacts
pnpm package:smoke
pnpm entrypoint:smoke
```

See [CONTRIBUTING.md](./CONTRIBUTING.md). CI covers macOS, Linux, Windows, and
Node.js 22/24.

## License

MIT
