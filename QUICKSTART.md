# RepoMemo in one minute

[简体中文](./QUICKSTART.zh.md)

**The project owns continuity; Agent Harnesses are replaceable entry points.**
RepoMemo makes the project Agent Native and uses Harness-native paths wherever
possible.

## 1. Initialize once

```bash
cd my-project
npx repomemo@latest init
```

No Node.js or npm yet? Use the macOS/Linux/Windows one-click installer in the
[README](./README.md#install). A China-mirror installer is included.

Git is optional. After this step, RepoMemo does not need to run when you
switch coding agents. The same command also works halfway through an existing
project without rebuilding it.

RepoMemo preserves existing files, but it cannot reconstruct private chat
history. Ask the current Agent to fill `AGENT_STATE.md` with the real progress
before switching.

## 2. Keep only three shared sources

- Put permanent project rules in `AGENTS.md`.
- Keep the current goal, progress, and next action in `AGENT_STATE.md`.
- Put reusable Skills in `.agents/skills/<skill-name>/SKILL.md`.

Do not copy these into Harness-specific files. RepoMemo uses native discovery
where available and tiny bridges only where required.

Claude Code receives the `.agents/skills` instruction through `CLAUDE.md` and
`AGENTS.md`, but does not natively catalog that directory. RepoMemo deliberately
avoids a `.claude/skills` alias because OpenCode, Cursor, and Copilot scan both
locations and can list every project Skill twice. Tested OpenCode 1.17.7 also
failed to catalog project `.agents/skills` after that alias was removed, so its
Skill support is reported as manual for this version rather than overstated as
native.

Gemini native Skill discovery requires Gemini CLI 0.26.0 or newer. Scoped
`doctor --harness ...` checks every Skill path consumed by that Harness, even
when the path originated as another Harness's compatibility location.

## 3. Switch directly

```bash
codex
# or: claude, gemini, opencode, cursor, copilot, zcode, dsh
```

Ask the agent to read the project rules and current state, then continue. Before
ending meaningful work, it should update `AGENT_STATE.md` for the next agent.

No `convert`, `sync`, `generate`, `export`, or `handoff` command is required.
Use a Harness version that supports the listed project paths and complete its
own workspace-trust prompt when required.

## 4. Check only when needed

```bash
npx repomemo@latest doctor
```

To repair only safe managed bridges and links:

```bash
npx repomemo@latest repair
```

For a later RepoMemo upgrade, rerun `npx repomemo@latest init` in the same
project. It upgrades managed blocks in place and should leave project state,
Skills, source files, and user-authored text untouched.

RepoMemo never initializes Git, runs Skill scripts, or migrates private chat
history. `doctor` validates the file contract; it does not run or upgrade the
installed Harness. The files in the project directory are the portable handoff.
