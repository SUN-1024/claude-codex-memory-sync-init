<!-- repomemo-state:v1 -->
# Agent State

- Status: blocked
- Updated: 2026-09-01T08:29:42Z
- Last Harness: codex
- Scope: .

## Goal

Release RepoMemo 2.0 as a Git-neutral Agent-native repository bootstrap.

## Completed

- Cloned and verified the v1.3 baseline at `0338cf0` with 18/18 legacy tests passing.
- Created the local `v1` preservation branch.
- Replaced the Bash implementation with a zero-runtime-dependency TypeScript CLI and single ESM bundle.
- Migrated the repository itself to the v2 contract and removed the v1 scaffold, converter-era assets, installer, and mirrored Homebrew formula.
- Added the data-driven eight-Harness registry, synchronized documentation, migration guide, and cross-platform CI/release workflows.
- Completed local release artifact, installed-package, `pnpm dlx`, `npx`, and self-doctor validation.
- Pushed the preserved `v1` branch and v2 implementation to GitHub without rewriting history.

## Decisions

- Work directly on local `main`, preserve v1 separately, and never force-push.
- Use Node.js 22+, pnpm, esbuild, a single ESM bundle, and zero runtime dependencies.
- Keep GitHub, npm, and Homebrew publication behind an interactive credential gate.

## Failed Attempts

- The system Homebrew Node 22 cannot load its current simdjson ABI; local development uses the bundled Node 24 runtime instead.
- pnpm initially blocked esbuild's install script until the project explicitly allowed only esbuild builds.
- GitHub CLI authentication is expired and npm is not logged in; publication requires the user's interactive login.
- The first hosted CI run exposed CRLF-sensitive matrix rendering on Windows; the renderer now preserves each README's native line endings.

## Touched Paths

- `src/`
- `tests/`
- `scripts/`
- `data/harnesses.json`
- `package.json`
- `pnpm-lock.yaml`
- `.github/workflows/`
- `AGENTS.md`
- `AGENT_STATE.md`
- `README.md`
- `README.zh.md`
- `MIGRATION-v1-v2.md`

## Validation

- Legacy Bash baseline: 18 passed, 0 failed.
- TypeScript v2 suite: 29 passed, 0 failed.
- Typecheck and generated support-matrix check passed.
- All 16 registry documentation URLs returned HTTP 200 through the configured proxy.
- `pnpm pack` produced only the intended six files; fresh tarball install, CLI binary, init, and doctor passed.
- Local `pnpm dlx` and `npx` tarball entrypoints both reported `repomemo 2.0.0`.
- Remote `origin/main` still matches baseline `0338cf0`; no rebase is needed.
- GitHub and npm authentication succeeded for `SUN-1024` and `sun1024`.
- The CRLF matrix fixture and the full local 29-test verification passed after the Windows fix.

## Next Action

Push the Windows CI fix, require all six hosted jobs to pass, then publish and verify GitHub/npm/Homebrew channels before marking this state done.
