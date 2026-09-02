# Contributing to RepoMemo

RepoMemo 2.x is intentionally small: a TypeScript CLI with no runtime
dependencies and no daily synchronization commands.

## Setup

Use Node.js 22 or newer and pnpm:

```bash
pnpm install
pnpm verify
```

The system under test must remain offline and Git-neutral. Development tooling
may download declared build dependencies, but the bundled CLI must never invoke
Git, curl, a network API, or a Skill script.

## Making changes

- Change compatibility evidence in `data/harnesses.json`, then run
  `pnpm matrix` and commit both synchronized README matrices.
- Preserve text outside managed markers. Add a regression test for every new
  conflict or repair behavior.
- Keep machine-readable doctor finding codes stable once released.
- Do not add proprietary Harness configuration conversion. Describe
  reachability only as native, bridge, manual, or unsupported.

## Done criteria

```bash
pnpm verify
pnpm pack --pack-destination artifacts
pnpm package:smoke
pnpm entrypoint:smoke
node dist/cli.js doctor --target . --json
```

CI repeats this work on macOS, Linux, and Windows with Node.js 22 and 24.
