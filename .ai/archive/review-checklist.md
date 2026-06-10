# Review Checklist

Use this list when reviewing any PR against this repository (or against a
project that adopted this scaffold). Items marked **(scaffold)** apply only to
the scaffold itself; items marked **(downstream)** apply to projects that
adopted the scaffold; items without a marker apply to both.

## Correctness

- [ ] `.ai/project.md` and `.ai/architecture.md` still match the actual
      repository — purpose, layout, dependencies, components.
- [ ] `.ai/handoff.md` was updated for this change before the PR was opened.
- [ ] If stable knowledge emerged during the work, `.ai/memory.md` was
      updated and the entry is genuinely durable (not task-specific).
- [ ] `CLAUDE.md`, `AGENTS.md`, and `opencode.md` list the **same** `.ai/`
      files in the **same** order. (scaffold + downstream)

## Tests

- [ ] **(downstream)** Unit / integration tests added or updated for the change.
- [ ] **(downstream)** Test commands recorded in `.ai/definition-of-done.md`
      still pass locally.
- [ ] **(scaffold)** `bash tests/test_repomemo.sh`,
      `bash bin/repomemo check .`, and
      `bash bin/repomemo check --strict .` pass.

## Typing / static analysis

- [ ] **(downstream)** Typechecker (e.g. `tsc`, `mypy`, `pyright`) passes.
- [ ] **(scaffold)** N/A.

## Lint / format

- [ ] **(downstream)** Linter and formatter configured in
      `.ai/definition-of-done.md` pass.
- [ ] **(scaffold)** Markdown reads cleanly; headings hierarchical; no
      malformed lists or broken `@./path` imports.

## Security

- [ ] No secrets, API keys, tokens, or private hostnames committed.
- [ ] **(downstream)** New dependencies vetted; lockfile updated.
- [ ] **(downstream)** Auth / permission changes called out explicitly in the
      PR description.

## Performance

- [ ] **(downstream)** No obvious N+1, unbounded loops, or hot-path
      regressions introduced.
- [ ] **(scaffold)** N/A.

## Documentation

- [ ] `README.md` and `README.zh.md` are mirrored when either changes.
- [ ] User-visible behaviour or workflow changes are reflected in the relevant
      `.ai/` file (usually `architecture.md` or `definition-of-done.md`).
- [ ] No `TODO` / `TBD` / placeholder text introduced.

## Compatibility

- [ ] No symlinks added inside the repo (Windows + shallow-clone hostile).
- [ ] **(downstream)** Public API / config / CLI changes flagged in the PR
      description with a migration note.

## Deployment risk

- [ ] **(downstream)** Migrations, feature flags, or rollout steps documented.
- [ ] **(scaffold)** Not applicable — nothing to deploy.

## Final pass

- [ ] PR description names the user-visible change in one sentence.
- [ ] Reviewer can follow `.ai/handoff.md` and reproduce the state described.
