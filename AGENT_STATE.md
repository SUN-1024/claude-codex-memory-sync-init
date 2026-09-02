<!-- repomemo-state:v1 -->
# Agent State

- Status: done
- Updated: 2026-09-02T08:59:50Z
- Last Harness: codex
- Scope: .

## Goal

Publish the fully validated RepoMemo 2.0.3 closure to GitHub and npm, create the
version tag and GitHub Release, update the Homebrew tap, and verify each public
installation path without weakening the offline, Git-neutral, zero-runtime-
dependency, and fail-closed contract.

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
- Removed the obsolete Claude and ZCode Skill aliases after real multi-Harness
  testing showed that compatibility links create duplicate discovery paths.
  Claude and tested OpenCode 1.17.7 now report the canonical `.agents/skills`
  fallback honestly as `manual`; Cursor, Copilot, ZCode, Codex, Gemini, and DSH
  retain their registry-backed native claims at their documented evidence levels.
- Completed an independent, repository-external adversarial QA pass against a
  realistic mid-development TypeScript project, with no RepoMemo product-code changes.
- Confirmed three release-significant defects: the current ZCode bridge creates
  duplicate Skill discovery, non-UTF-8 managed files are silently corrupted, and
  bridge import detection can disagree with real Harness Markdown/import semantics.
- Confirmed additional robustness gaps around invalid Skill structure, cross-Harness
  discovery overlap, partial writes, broad targets, JSON error output, placeholder
  state detection, nested-directory performance, and concurrent-init warnings.
- Closed all 13 confirmed findings (3 high, 7 medium, and 3 low) with automated
  regressions and a repository-external acceptance suite; no finding remains open.
- Completed a second repository-external QA round with three independent lanes:
  17 black-box scenario groups, source-level white-box review, and an eight-Harness
  switching matrix. This round found 12 new issues (2 high, 6 medium, 4 low) while
  leaving product code unchanged. Evidence is retained under
  `/Users/sun/Documents/myRepo/repomemo-blackbox-round2` and
  `/Users/sun/Documents/myRepo/repomemo-multiharness-qa-20260902`.
- Closed all 12 second-round findings in RepoMemo 2.0.2. Shared temporary roots
  are rejected; all consumers diagnose and repair the obsolete Claude alias;
  repair reports mutations and lock failures consistently; YAML scalar typing,
  README conflicts, timestamps, touched paths, ancestor/nested diagnostics, and
  Gemini's minimum version boundary now fail closed or report exact scope.
- Closed the four associated robustness risks with staged alias removal and
  reinspection, inode-checked stale-lock quarantine, surfaced rollback failures,
  and HTML-comment-aware bridge detection. The bilingual matrix renderer now
  validates both files before writing and performs a reversible two-file update.
- Added focused regressions and package-smoke coverage, bringing the TypeScript
  suite to 63 tests. Scoped OpenCode, Cursor, and Copilot repair was also exercised
  independently against real filesystem aliases.
- Added a whole-project repair preflight so malformed or otherwise non-repairable
  contract errors stop before any bridge, alias, or Skill mutation. Startup usage
  failures now preserve JSON mode, `repair` reports its own option errors, and the
  redundant `repair --repair` spelling is rejected.
- Corrected direct text-mode `repair` summaries to identify the actual command;
  2.0.3 supersedes the short-lived GitHub-only 2.0.2 release before npm or
  Homebrew publication.
- Closed the final lock-artifact cleanup gaps: dead pre-publication candidates
  and choosing files are reclaimed, and setup failure removes any contender that
  was already published by that same unique token.
- Made legacy stale-lock quarantine tolerate the short post-rename visibility
  window observed on Windows while preserving byte-for-byte owner validation.
- Completed the lock protocol's cross-version boundary: every uncertain artifact
  forces a fresh fail-closed scan, choosing and contender metadata publish by
  atomic rename, the elected writer holds a tokenized legacy sentinel throughout
  its action, and cleanup retries transient Windows filesystem errors.
- Published RepoMemo 2.0.3 from commit `5e3f30c`: annotated tag and GitHub Release,
  public npm `latest`, and Homebrew tap commit `25763e1`. All release assets and
  public npm/Homebrew installation paths were independently verified.

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
- Earlier OpenCode smoke testing incorrectly treated a successful run as proof of
  native `.agents/skills` catalog discovery. Instrumented OpenCode 1.17.7 testing
  later showed that the Claude alias caused duplicate discovery, while removing
  it yielded no project Skill catalog even inside a Git worktree. The registry
  now records this tested limitation as `manual` and `provisional`.
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
- In the second QA round, Claude Code, Cursor, and Copilot CLIs remained unavailable;
  their discovery-path checks used current official contracts and were not labeled
  live runtime passes. DSH's headless probe produced no output within 30 seconds and
  was terminated; only its installed source was counted. Gemini 0.1.12 was old enough
  to expose the newly recorded missing-version-boundary defect.
- The first 2.0.2 release-candidate CI run `33605381845` passed macOS and Linux
  but exposed that Node's numeric NTFS `dev`/`ino` identity is not stable across
  every Windows rename. Stale-lock quarantine now uses stable size/timestamp
  identity on Windows while retaining device/inode identity on POSIX.
- Follow-up run `33605677910` showed that NTFS rename timestamps are also not a
  portable identity boundary. The final lock protocol writes a complete unique
  candidate first and atomically publishes it with a same-volume hard link;
  Windows quarantine validation compares the unique owner bytes.
- Run `33606193721` proved that any reused fixed lock path still lacks a portable
  compare-and-swap boundary. The final protocol uses unique contender files and
  deterministic election; only the elected contender inspects a legacy fixed
  lock, and no current writer ever deletes another writer's reusable path.
- Run `33606876353` passed Windows verification after unique contenders, then a
  repeated macOS prepack exposed that arrival-time ordering alone can admit a
  delayed earlier-ranked contender. The lock now uses an explicit choosing phase
  and Lamport-style `(ticket, token)` ordering.
- Run `33608743328` passed five of six platform/runtime jobs but Windows Node 22
  exposed a transient post-rename read failure during legacy stale-lock quarantine;
  the bounded retry keeps the migration fail closed without reporting a false
  content change or abandoning the recoverable lock.
- Local Homebrew reinstall and strict audit were blocked by the host's outdated
  Command Line Tools on pre-release macOS 27. The formula download and checksum
  succeeded locally, and clean Homebrew CI completed install, test, style, and
  strict audit instead; the existing local 1.3.0 binary was left untouched.
- The narrow transient-read fix passed all six jobs in run `33609416745`; final
  white-box review then identified and closed the broader uncertain-snapshot and
  live old-binary compatibility windows before tagging.

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
  Skill/state discovery passed in Codex, ZCode, and DSH; OpenCode 1.17.7's missing
  alias-free project catalog is explicitly reported instead of counted as native.
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
- Final adversarial closure passes all 13/13 external checks. The TypeScript suite
  passes 49/49 on both Node.js 22.23.2 and the bundled Node.js 24 runtime; matrix,
  package, `pnpm dlx`/`npx` entrypoint, standard/China installer, production audit,
  and repository self-doctor checks also pass. The self-doctor is healthy with
  only informational Claude/OpenCode manual-mode and Git findings.
- Second-round black-box QA passed 16/17 scenario groups and independently found
  that macOS shared `/tmp` and `/var/tmp` roots bypass the dangerous-target guard.
  Live/installed Harness checks passed for Codex rule/state/Skill reading, Gemini
  rule import, OpenCode catalog instrumentation, and ZCode canonical catalog.
  White-box and cross-Harness review confirmed 11 additional issues involving
  scoped duplicate-path diagnosis, repair reporting, YAML typing, locking, JSON
  timeouts, matrix markers, version bounds, and lower-severity state/diagnostic
  consistency. No product fix was made during this testing-only round.
- RepoMemo 2.0.2 passes 63/63 tests, typecheck, and generated bilingual matrix
  checks on both Node.js 22.23.2 and the bundled Node.js 24 runtime.
- The fourteen-file `repomemo-2.0.2.tgz` passes fresh-package smoke and standard/
  China installer smoke; `pnpm audit --prod` reports no known vulnerabilities.
- The prior external 13-finding acceptance verifier remains 13/13 green, and the
  refreshed eight-Harness matrix confirms healthy clean projects, scoped duplicate
  alias diagnosis, honest Gemini/OpenCode boundaries, and path-bearing ancestor
  findings. Real OpenCode 1.17.7 instrumentation still demonstrates why the old
  Claude alias is unsafe, while the embedded ZCode CLI catalogs the canonical
  Skill exactly once.
- Repository self-init is byte-idempotent (`0 change(s)`), self-doctor is healthy,
  and `git diff --check` passes. No commit, push, tag, npm publish, GitHub Release,
  or Homebrew update was performed in this local closure goal.
- The release-gate suite now passes 65/65 locally; the focused lock suite passed
  50 consecutive repetitions, followed by package and entrypoint smoke tests.
- The expanded suite passes 69/69 locally after adding legacy-sentinel and live-
  quarantine regressions. The complete seven-test lock suite passed 100 consecutive
  repetitions, and an independent final white-box review found no remaining
  mutual-exclusion release blocker for RepoMemo's sub-24-hour command boundary.
- Hosted CI run `33610910568` passed all six macOS, Ubuntu, and Windows jobs on
  Node.js 22/24. GitHub Release workflow `33611163394` published three assets;
  the downloaded checksum manifest verified both `repomemo.js` and the npm tarball.
- Public npm reports `repomemo@2.0.3` as `latest`; a fresh non-Git directory passed
  public `npx` version, init, and healthy doctor checks.
- Homebrew tap CI run `33611595728` passed clean install, formula test, style, and
  strict audit for 2.0.3. The formula uses the GitHub asset digest
  `ebc969471de60b48799c4e89f12a79ef1d99cd9300bd02da301606a3c0771131`.
- Six reappearing untracked v1.3 iCloud conflict copies were preserved outside
  the repository at `/Users/sun/Documents/myRepo/repomemo-conflict-files-20260902`.

## Next Action

No active release work remains. Start the next change from the public 2.0.3
baseline and retain the same multi-platform verification gates.
