<!-- repomemo-state:v1 -->
# Agent State

- Status: done
- Updated: 2026-09-01T08:49:07Z
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
- Published annotated tag and GitHub Release `v2.0.0` with the CLI bundle, npm tarball, and checksums.
- Published public npm package `repomemo@2.0.0` and verified it from a fresh directory.
- Published and clean-tested the v2 Homebrew formula in `SUN-1024/homebrew-repomemo`.

## Decisions

- Work directly on local `main`, preserve v1 separately, and never force-push.
- Use Node.js 22+, pnpm, esbuild, a single ESM bundle, and zero runtime dependencies.
- Keep GitHub, npm, and Homebrew publication behind an interactive credential gate.

## Failed Attempts

- The system Homebrew Node 22 cannot load its current simdjson ABI; local development uses the bundled Node 24 runtime instead.
- pnpm initially blocked esbuild's install script until the project explicitly allowed only esbuild builds.
- GitHub CLI authentication is expired and npm is not logged in; publication requires the user's interactive login.
- The first hosted CI run exposed CRLF-sensitive matrix rendering on Windows; the renderer now preserves each README's native line endings.
- The first npm publish was rejected until the account enabled publish-protecting 2FA.
- Public `npx` verification initially ran from RepoMemo's own source directory, causing npm to treat the root package as already installed; a truly fresh directory passed.
- Homebrew clean CI found downloaded JavaScript needed an explicit executable mode and strict audit rejected a redundant version field; both formula defects were fixed.

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
- Hosted repository CI passed all six macOS/Linux/Windows and Node 22/24 jobs in run `33487338957`.
- GitHub Release workflow `33487497651` passed and uploaded three verified assets.
- Public `npx repomemo@2.0.0` version, init, and doctor passed in an empty non-Git directory.
- Homebrew clean install, wrapper, init, doctor, style, and strict audit passed in run `33488601249`.
- The local tap now resolves stable `2.0.0`; the pre-existing local v1.3 install was not upgraded because its Homebrew Node 22 runtime has an unrelated ABI defect.

## Next Action

No release action is pending. Monitor issue reports; publish a new immutable patch version rather than rewriting `v2.0.0` if a blocking defect is found.
