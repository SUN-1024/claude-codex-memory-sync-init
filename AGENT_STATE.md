<!-- repomemo-state:v1 -->
# Agent State

- Status: done
- Updated: 2026-09-02T05:24:33Z
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
- Retained full real-case evidence outside the repository in a dated QA bundle.
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
- Added user-local macOS/Linux and Windows one-click installers plus China
  entrypoints that automatically select npmmirror for Node.js and npm packages.
- Added installer smoke coverage for global and China modes, project paths with
  spaces, version, init, doctor, repair, shell syntax, and persisted PATH text.
- Expanded both README installation sections with one-click, China-mirror, npx,
  pnpm, npm, China npm registry, and Homebrew paths.
- Added a generated RepoMemo 2.0 README infographic and a bilingual positioning
  section contrasting the v1/manual and converter-heavy workflows with the
  three-command Agent Native and Harness Native contract.
- Fixed every product-actionable finding from the independent adversarial pass:
  ZCode now uses `.agents/skills` natively and old exact links are removed;
  Markdown-aware Claude/Gemini import detection ignores code regions and accepts
  inline imports; non-UTF-8 text fails closed; Skills receive portable schema
  checks; vendor Skill directories can be adopted without byte changes; staged
  file writes roll back; broad targets, JSON I/O failures, placeholder state,
  generated-directory scans, concurrent links, and evidence versions are handled.
- Hardened China bootstrap delivery with full-download-before-execute semantics,
  jsDelivr/GitHub fallback, Node.js 24 LTS, x64 musl Linux support, absolute-path
  checks, checksum verification, and atomic wrapper replacement.
- Published the RepoMemo 2.0 positioning infographic, synchronized bilingual
  landing-page copy, and all four standard/China installer entrypoints to `main`.
- Replaced the shared infographic with user-provided, language-specific English
  and Chinese campaign images and wired each README to its matching asset.
- Kept Claude Code's required `.claude/skills` compatibility link while removing
  only ZCode's obsolete alias; runtime link behavior now derives from the Harness
  registry so code and generated compatibility matrices cannot silently diverge.
- Completed an independent, repository-external adversarial QA pass against a
  realistic mid-development TypeScript project, with no RepoMemo product-code changes.
- Confirmed three release-significant defects: the current ZCode bridge creates
  duplicate Skill discovery, non-UTF-8 managed files are silently corrupted, and
  bridge import detection can disagree with real Harness Markdown/import semantics.
- Confirmed additional robustness gaps around invalid Skill structure, cross-Harness
  discovery overlap, partial writes, broad targets, JSON error output, placeholder
  state detection, nested-directory performance, and concurrent-init warnings.

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
- Keep bootstrap networking outside the RepoMemo CLI: the optional root installers
  install a private checksum-verified Node/npm runtime without Git, Homebrew,
  system Node replacement, or sudo; CLI commands remain local and offline.

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
- ZCode GUI automation could not initialize the local app-server; the installed
  application's embedded CLI and implementation were used for read-only catalog verification.
- OpenCode model execution was blocked by its own SQLite schema error; Gemini by
  missing authentication; ZCode model execution by missing model configuration;
  Claude Code, Cursor, and Copilot CLIs were not installed. These are coverage
  limits, not RepoMemo defects.

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
- `install.sh`
- `install-cn.sh`
- `install.ps1`
- `install-cn.ps1`
- `MIGRATION-v1-v2.md`

## Validation

- Legacy Bash baseline: 18 passed, 0 failed.
- TypeScript v2.0.1 suite: 35 passed, 0 failed.
- Typecheck and generated support-matrix check passed.
- All 16 registry documentation URLs returned HTTP 200 through the configured proxy.
- `pnpm pack` produced the intended fourteen files; fresh tarball install, CLI binary,
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
- Hosted CI run `33590636163` passed all six macOS, Linux, and Windows jobs on
  Node 22/24, including verification, package smoke, `pnpm dlx`, and `npx`.
- Standard and China installer smoke passed locally on macOS using the packaged
  2.0.1 tarball. A forced-private-runtime China case downloaded Node v22.23.2
  from npmmirror, verified SHA-256, installed without system npm/Homebrew/Git,
  and produced a healthy initialized project under the retained E2E evidence directory.
- The adversarial black-box suite produced one full round-trip pass and eight
  targeted issue reproductions; all eight Harness-filtered doctors stayed healthy
  in the valid realistic fixture, and repeated init remained byte-idempotent.
- Live read-only model checks passed in Codex 0.151.0-alpha.7.2 and DSH
  0.1.2-alpha.4 for the same rule, Next Action, and Skill nonce.
- Independent package validation passed 35/35 tests, typecheck, support-matrix
  synchronization, tarball smoke, `pnpm dlx`, `npx`, self-doctor, and production audit.
- The repaired suite now passes 47/47 tests, including the former adversarial
  reproducers for ZCode duplication, strict UTF-8, fenced/inline imports, invalid
  Skills, vendor Skill adoption, stale placeholders, stable JSON errors, broad
  targets, scan exclusions, transactional staging, and concurrent init.
- The new fourteen-file 2.0.1 tarball passes package, `pnpm dlx`, `npx`, repeated
  global/China installer, production audit, and self-doctor checks on macOS.
- A forced-private China bootstrap downloaded checksum-verified Node v24.20.0
  from npmmirror and installed RepoMemo 2.0.1 into paths with spaces without
  system Node/npm, Git, Homebrew, or sudo. Evidence remains outside the repository.
- A retained real 2.0.0-to-2.0.1 in-place upgrade removed the obsolete ZCode
  bridge, preserved source/Skill/state hashes, converged to `0 change(s)`, and
  passed doctor in the external QA bundle.
- Final local verification passes 48/48 tests twice, including quoted and folded
  YAML Skill frontmatter, followed by package, entrypoint, installer, audit, and
  repository self-doctor checks.
- Hosted CI run `33594097710` passes all six macOS, Ubuntu, and Windows jobs on
  Node.js 22/24, including both PowerShell installer entrypoints.
- Live GitHub README files and the infographic match the committed files. The
  jsDelivr China entrypoint downloaded the standard installer, installed 2.0.1
  from the verified package artifact into paths with spaces, initialized a
  realistic in-progress project, and returned a healthy eight-Harness report.
- Both localized replacement images are byte-identical to the supplied PNGs;
  48/48 verification passes twice, and the fourteen-file package smoke test
  confirms that both assets ship in the npm tarball.

## Next Action

The implementation goal is complete. Keep npm, GitHub Release, and Homebrew
2.0.1 publication behind explicit release authorization; until then, public
package-manager `latest` remains 2.0.0 even though `main` contains validated
2.0.1 source and installers.
