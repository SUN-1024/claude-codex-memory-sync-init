# Memory — durable shared knowledge

Stable, slow-changing facts. One sentence per entry. Do NOT put current progress,
active runs, PIDs, or task status here — those belong in `handoff.md`.

## Repository nature

- This repository is both the CLI tool and the convention it ships.
- The CLI is a single Bash script. No compiler or build step.

## Adapter conventions

- `CLAUDE.md` and `opencode.md`: thin @import wrappers + agent-specific instruction.
- `AGENTS.md`: numbered file list + post-task update rule.
- All three adapters exist in two places: repo root and `templates/`. Both
  copies must always be in sync with `SCAFFOLD_FILES`.

## CLI conventions

- `init` is safe by default — skips existing files. Only `--force` overwrites.
- `check --strict` verifies adapter read order and template sync.
- `check --verify` adds memory freshness and adapter instruction checks.
- `upgrade` updates root adapters only; `--fetch` pulls from GitHub main branch.
- `fix` restores corrupted adapters, fills missing `.ai/` files, warns about
  external memory stores.
- Template directory resolved relative to script location. Homebrew formula
  rewrites the path at install time.

## Distribution

- Tap: `SUN-1024/homebrew-repomemo`. Formula at `homebrew/repomemo.rb` is a
  reference copy.
- npm package name: `repomemo`.
- Version bump: 5 files (`bin/repomemo`, `homebrew/repomemo.rb`, `package.json`,
  `tests/test_repomemo.sh`, git tag).

## Branding

- Tool-neutral. No single AI agent is named as contributor, author, or owner.
- Listed agents are compatibility targets only.

## Language

- All `.ai/` content in English.
- Human-facing READMEs: bilingual (English + Simplified Chinese).

## Cross-platform

- No symlinks. Real adapter files.
- Bash 3.2 target (macOS default). No Bash 4+ syntax.

## Common pitfalls

- Some agents have built-in private memory systems (e.g. Claude Code's
  `~/.claude/projects/.../memory/`). Root adapters instruct agents to route
  project knowledge to `.ai/` instead.
- Do not add hook configurations here.
- Do not rename `.ai/` — breaks all downstream consumers.
- Do not add Chinese text inside `.ai/`.
