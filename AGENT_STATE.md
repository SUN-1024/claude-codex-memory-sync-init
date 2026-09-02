<!-- repomemo-state:v1 -->
# Agent State

- Status: done
- Updated: 2026-09-02T04:23:23Z
- Last Harness: codex
- Scope: .

## Goal

Prepare and comprehensively validate RepoMemo 2.0.1: expose the concise
`init`, `doctor`, and `repair` workflow; support fresh and mid-project adoption,
safe in-place upgrades, and honest cross-Harness diagnosis and recovery.

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
- Initialized RepoMemo 2.0 in 24 additional local Codex projects; RepoMemo itself was already initialized.
- Preserved `LAVIC_second` unchanged because its RepoMemo v1 signature requires manual migration.
- Added paired English and Chinese one-minute guides and linked them from both READMEs.
- Made `repair` the canonical repair command while retaining `doctor --repair`
  as a compatibility alias for existing automation.
- Added explicit diagnostics for unfilled handoff state and OpenCode's observed
  non-Git skill-discovery limitation without changing RepoMemo's Git-neutral contract.
- Added regression coverage for mid-project adoption, managed-contract upgrades,
  user-content preservation, repair, idempotency, package entrypoints, and version drift.
- Hardened package smoke tests against stale `pnpm dlx` tarball caching by using
  unique package paths and by exercising the installed `repair` command.
- Updated the GitHub repository description to match the current Git-neutral v2 design.
- Retained full real-case evidence under
  `/Users/sun/Documents/myRepo/repomemo-e2e-cases-20260902`.
- Reframed the bilingual GitHub landing pages and one-minute guides around the
  concise Agent Harness, Agent Native, and Harness Native model: initialize once,
  keep continuity in the project, and switch Harnesses without conversion.
- Simplified installation to one recommended `npx repomemo@latest init` path,
  with optional npm and Homebrew installation kept secondary.
- Updated the live GitHub description and repository topics to match the same
  Agent Native and Harness Native positioning.
- Corrected the legacy-repair and installed-package link assertions to compare
  filesystem canonical realpaths across POSIX symlinks and Windows junctions.
- Made the `npx` entrypoint smoke invoke the Windows `.cmd` shim through the
  Windows shell and report underlying spawn errors while keeping POSIX direct execution.

## Decisions

- Work directly on local `main`, preserve v1 separately, and never force-push.
- Use Node.js 22+, pnpm, esbuild, a single ESM bundle, and zero runtime dependencies.
- Keep GitHub, npm, and Homebrew publication behind an interactive credential gate.
- Limit this batch to local Codex projects; leave the two remote saved projects untouched pending an explicit remote pass.
- Keep RepoMemo file-contract-only: `doctor` diagnoses and `repair` restores only
  managed files and compatibility links; neither command launches, authenticates,
  upgrades, or configures third-party Harness runtimes.
- Preserve user-authored rules, state, and skills during both mid-project adoption
  and compatible upgrades; fail closed on ambiguous managed markers.

## Failed Attempts

- The system Homebrew Node 22 cannot load its current simdjson ABI; local development uses the bundled Node 24 runtime instead.
- pnpm initially blocked esbuild's install script until the project explicitly allowed only esbuild builds.
- GitHub CLI authentication is expired and npm is not logged in; publication requires the user's interactive login.
- The first hosted CI run exposed CRLF-sensitive matrix rendering on Windows; the renderer now preserves each README's native line endings.
- The first npm publish was rejected until the account enabled publish-protecting 2FA.
- Public `npx` verification initially ran from RepoMemo's own source directory, causing npm to treat the root package as already installed; a truly fresh directory passed.
- Homebrew clean CI found downloaded JavaScript needed an explicit executable mode and strict audit rejected a redundant version field; both formula defects were fixed.
- A first OpenCode hypothesis assumed a Claude compatibility link was required;
  stricter Git-worktree testing proved `.agents/skills` is discovered natively, so
  the unnecessary bridge change was reverted.
- Reusing a rewritten tarball at the same path allowed `pnpm dlx` to serve stale
  CLI content; the entrypoint smoke now copies each artifact to a unique path.
- Current Gemini testing is blocked by its account/backend `UNSUPPORTED_CLIENT`
  eligibility error; current Claude testing is blocked by a locally configured
  unrecognized model. Cursor, Copilot CLI, and ZCode executables are not installed.
- Hosted CI run `33590116620` exposed a test-only Windows assumption: the test
  expected a POSIX relative symlink string, while Windows correctly returned an
  absolute junction target.
- Follow-up run `33590277330` exposed Windows 8.3 short-path versus long-path
  spellings for the same junction destination; the final assertions compare
  `realpath` values on both sides rather than textual path representations.
- Run `33590445805` passed Windows verification and package smoke, then exposed
  that Node cannot directly spawn the `npx.cmd` shim without a Windows shell;
  only the internally generated Windows smoke invocation now uses that shell.

## Touched Paths

- `src/`
- `tests/`
- `scripts/`
- `package.json`
- `.github/workflows/`
- `AGENTS.md`
- `AGENT_STATE.md`
- `README.md`
- `README.zh.md`
- `QUICKSTART.md`
- `QUICKSTART.zh.md`
- `MIGRATION-v1-v2.md`

## Validation

- Legacy Bash baseline: 18 passed, 0 failed.
- TypeScript v2.0.1 suite: 35 passed, 0 failed.
- Typecheck and generated support-matrix check passed.
- All 16 registry documentation URLs returned HTTP 200 through the configured proxy.
- `pnpm pack` produced the intended eight files; fresh tarball install, CLI binary,
  init, doctor, canonical repair, legacy repair alias, `pnpm dlx`, and `npx` passed.
- Remote `origin/main` still matches baseline `0338cf0`; no rebase is needed.
- GitHub and npm authentication succeeded for `SUN-1024` and `sun1024`.
- The CRLF matrix fixture and the full local 29-test verification passed after the Windows fix.
- Hosted repository CI passed all six macOS/Linux/Windows and Node 22/24 jobs in run `33487338957`.
- GitHub Release workflow `33487497651` passed and uploaded three verified assets.
- Public `npx repomemo@2.0.0` version, init, and doctor passed in an empty non-Git directory.
- Homebrew clean install, wrapper, init, doctor, style, and strict audit passed in run `33488601249`.
- The local tap now resolves stable `2.0.0`; the pre-existing local v1.3 install was not upgraded because its Homebrew Node 22 runtime has an unrelated ABI defect.
- All 25 initialized local Codex projects passed `doctor`; a repeated dry-run reported 0 changes for every project.
- The bilingual-guide change passed typecheck, 29/29 tests, matrix check, `pnpm pack`, and fresh-package smoke testing with the bundled Node 24 runtime.
- The package tarball contains both `QUICKSTART.md` and `QUICKSTART.zh.md`.
- Fresh, mid-project, v2.0.0-to-v2.0.1 upgrade, deliberate-damage repair,
  non-Git, and Git-backed OpenCode cases passed; source, notes, state, user rules,
  and user skills retained their expected hashes.
- All eight registry Harness contracts pass RepoMemo `doctor`. Real read-only
  skill/state discovery passed in Codex, OpenCode (Git worktree), and DSH.
- `pnpm audit --prod` reports no known vulnerabilities and the package retains
  zero production dependencies.
- The full 35-test verification, prepack verification, fresh-package smoke,
  `pnpm dlx`, and `npx` entrypoint smoke all pass on an independent Node 22.23.2
  runtime as well as the bundled Node 24 development runtime.
- Repository self-doctor is healthy with only the informational `.git` notice;
  the old ignored harness demo was moved into the retained external evidence set.
- The simplified bilingual documentation passed 35/35 tests, typecheck, matrix
  synchronization, package creation, fresh-package smoke, `pnpm dlx`, `npx`, and
  whitespace validation; all four guides remain included in the 2.0.1 tarball.

## Next Action

Confirm the pushed `main` CI result. Publish a new immutable `v2.0.1` GitHub,
npm, and Homebrew release only with explicit release authorization. Third-party
Harness authentication/model/runtime issues remain outside RepoMemo's safe scope.
