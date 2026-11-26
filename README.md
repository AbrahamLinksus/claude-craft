# Craft

Craft is a workstation for Claude agents: a keyboard-first, terminal-styled desktop app to run and watch several Claude Agent SDK sessions at once. Each session works in its own git worktree and branch.

## Status

Milestone 1 of 12: foundation and spikes. Today the app opens, starts its background service (the daemon), shows the Startup screen and reconnects to the daemon. Sessions, the grammar, git views and grafts are not built yet. The design is in `docs/SPEC.md` (product) and `docs/LLD.md` (as-built module design, §0 overview).

## Requirements

- Windows 11 (first target)
- Node.js 24 (package.json requires 24.11 or later; the dev baseline is 24.22.3)
- pnpm 12.23.0 (pinned by `packageManager` in package.json; enable with `corepack enable`)
- Git, and Git Bash for the `bash` scripts

## Setup (fresh clone)

```
git clone https://github.com/AbrahamLinksus/claude-craft.git
cd claude-craft
pnpm install
git config core.hooksPath .githooks
bash scripts/setup-tools.sh
```

`setup-tools.sh` downloads the pinned gitleaks binary (checksum checked) into `.tools/bin/`, which is git-ignored. Craft needs no `.env` file to run. `.env.example` lists the optional dev-only variables (`CRAFT_HOME`, `CRAFT_PIPE`, `CRAFT_LOG_LEVEL`, `CRAFT_DAEMON_ENTRY`, `CRAFT_RENDERER_URL`, `ANTHROPIC_API_KEY` for live spike tests only). Copy it to `.env` only if you need one of them.

## Run

There is no single start command at milestone 1. The app's entry points are `packages/daemon/src/main.ts` (background service) and `packages/client/src/main/index.ts` (desktop shell). A start script will be added with the app's first runnable build.

## Checks

```
bash scripts/check.sh
CHECK_NO_COVERAGE=1 bash scripts/check.sh
```

The full check runs lint, format, types, layer rules, tests with coverage, the sample graft check (a stub at this milestone) and a secret scan. Every step runs and prints its result; the script exits non-zero if any step fails. `CHECK_NO_COVERAGE=1` skips only the coverage thresholds.

## Repo layout

- `packages/protocol/`: wire messages and shared types (daemon, client and grafts)
- `packages/daemon/`: background service that owns the sessions
- `packages/client/`: Electron desktop app (main, preload, renderer)
- `spikes/`: throwaway spikes behind the design decisions (SDK, shell)
- `docs/`: SPEC, LLD, decisions and the owner's original spec under `docs/source/`
- `scripts/`: `check.sh` (full gate) and `setup-tools.sh`
- `.githooks/`: pre-commit lint, format and secret checks

## Sign-in

Craft uses Claude's own, unmodified sign-in, or an API key if you choose one. It never reads, stores or forwards your Claude login itself.
