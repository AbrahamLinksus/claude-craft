# CONVENTIONS — Craft (repo `claude-craft`)

> Written by the Architect with the LLD and approved by the owner. Every coder reads this
> before every task; the Tester enforces section 6 automatically, and the Reviewer
> enforces sections 2–5. Design facts live in `docs/LLD.md` (cited as §n); this file holds rules only.

## 1. Stack-specific style
- TypeScript 6.0.x, `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; ESM only; no `any` (use `unknown` + zod); no non-null `!` except in tests.
- Named exports only; one public `index.ts` per daemon module (LLD §0.3 `module-via-index`); file names `kebab-case.ts`, types/classes `PascalCase`, functions `camelCase`, event types `PascalCase` (core) or `<graft>/<kebab-name>` (graft).
- Every value crossing a boundary is parsed with zod: wire messages, files in `~/.craft`, manifests, graft settings, SDK messages (structurally, LLD §6.2). Types are `z.infer` of the schema, never written twice.
- Async: no floating promises (`@typescript-eslint/no-floating-promises`); every long wait takes an `AbortSignal`; no `setTimeout` for logic in core (inject `Clock`).
- React: function components + hooks; state from `useCraft(selector)` only (LLD §13.2); no direct pipe access in components; sizes in grid cells via theme tokens, no raw pixel or colour literals outside `renderer/theme/`.
- Product text says "Craft"; never "Claude Code" (research §2). User-facing strings for errors come from `protocol/errors.ts` (LLD §16.1).
- Windows first: build paths with `node:path`, never string-join `/`; spawn with argument arrays (no shell strings) except the race/orchestrator `commands.run`, which runs the owner's configured command through the shell on purpose.

## 2. Layering (dependencies point inward only)
```
client/renderer (screens → shell → state/input) ─► graft-ui ─► protocol
client/main (launcher, link, bridge) ─► protocol
grafts/*/ui ─► graft-ui          grafts/*/daemon ─► graft-api ─► protocol
daemon/main.ts (composition root) ─► daemon modules ─► other modules' index.ts ─► domain/ ─► protocol
```
- Grafts import only the graft API (daemon part) or graft UI API (UI part); never the SDK, git, `node:fs`/`child_process`/`net`, core internals, or another graft. Grafts talk to each other only through bus events.
- Only `daemon/src/agent/sdk-adapter/` imports the Agent SDK. Only `git/worker/`, `agent/sdk-adapter/` and `process/` spawn processes.
- `daemon/src/domain/` is pure: no `node:*`, no I/O, no clock reads.
- A daemon module imports another module only through its `index.ts`; concrete classes are created only in `main.ts`.
- The client never imports daemon or graft-api code; the renderer never imports `node:*` or `electron`.
- These are enforced by dependency-cruiser with the exact rules in LLD §0.3; a violation fails `scripts/check.sh`.

## 3. SOLID: what it means in this project

| Principle | Rule here |
|---|---|
| **S**ingle responsibility | One reason to change per module/class. I/O (files, pipe, git, SDK) stays in adapters; decisions (caps, numbering, redaction, chain order, sentence parsing) are pure functions in `domain/` or the client's `input/`. Name by capability (`SessionHost`, `InterceptionChain`), never `Manager`/`Utils`. |
| **O**pen/closed | New behaviour = a new graft, interceptor, screen folder, command file or store migration file, never a new branch in a shared switch. |
| **L**iskov substitution | Implementations honour the interface fully: fakes in `tests/_support` pass the same contract tests as the real adapters. |
| **I**nterface segregation | Small interfaces per client: `GitRead` vs `GitWrite`, `ToolGate` vs `ApprovalGate`, capability-gated graft handles. |
| **D**ependency inversion | Services receive interfaces through constructors; only `daemon/src/main.ts` (and `client/src/main/index.ts`) construct concrete classes. |

**Where to abstract** (variation points from LLD §0.3, and only these): `AgentPort`, `ToolGate`/`ApprovalGate`, `WorkspacePort`, `GitRead`/`GitWrite`, `ProcessReaper`, `Transport`, `Clock`, store `FileSystem`. Elsewhere use plain functions and concrete classes; don't add an interface with one implementation and no planned second one.

## 4. Limits
- Function ≤ 40 lines (`.tsx` components ≤ 80); cyclomatic complexity ≤ 10; parameters ≤ 4 (use an options object beyond that).
- File ≤ 300 lines; class ≤ 200 lines.
- No commented-out code, no `console.*` (use the daemon logger, LLD §16.2; the client uses `window.craft` log forwarding), no TODOs without a task ID.

## 5. Errors, logging, config, tests
- Errors: throw `CraftError` with a code from `protocol/errors.ts`; the command router turns it into `reply {ok:false}`; graft errors are caught by the graft host guard. Interception fails closed: an interceptor error or timeout holds the tool call and asks the owner (LLD §8.3); no code path may turn an error into "allow". Never swallow an error without a Notice or a log line.
- Logging: structured JSON lines; never log the API key, prompts, agent text or tool output (ids and sizes only).
- Config: settings only through the store (LLD §5) with zod schemas and defaults; no magic numbers in logic (name them in the module's `constants.ts` or settings).
- Files: one writer per file; atomic writes for JSON (write-file-atomic); the event log appends whole lines (LLD §4.2).
- Tests: vitest, Arrange-Act-Assert, one behaviour per test, names `<unit> <condition> <expected>` in `it(...)`; per-feature folders (`packages/daemon/tests/<module>/`, `grafts/<name>/tests/`, `packages/client/tests/<area>/`); external services faked through their interfaces (`FakeAgentPort`, `MemoryStore`, `FakeClock`); git tested against real temp repos; no live Claude calls in `check.sh` (live contract tests run only with `CRAFT_LIVE=1`). End-to-end tests (Playwright Electron) in `packages/client/tests/e2e/` tagged with the story id `(US-xx)`.

## 6. Automated checks (`scripts/check.sh` must pass; Tester runs it on every task)

Coders and the debugger run `CHECK_NO_COVERAGE=1 scripts/check.sh` (every check except the coverage
threshold, since tests are the Tester's job); the Tester runs the full script and owns coverage.
`check.sh` runs under Git Bash on Windows (the tested platform) and plain bash elsewhere.

| Check | Command |
|---|---|
| Lint | `pnpm eslint .` (typescript-eslint `strictTypeChecked`, react-hooks; `complexity: 10`, `max-lines-per-function: 40` (80 for `*.tsx`), `max-params: 4`, `max-lines: 300`, `no-console`) |
| Format | `pnpm prettier --check .` |
| Types | `pnpm -r exec tsc --noEmit` (strict, TS 6.0.x) |
| Layer rules | `pnpm depcruise packages grafts tools --config .dependency-cruiser.cjs` (rules in LLD §0.3) |
| Unit + integration tests + coverage | `pnpm vitest run --coverage` with `coverage.thresholds` 80 for lines, functions, branches and statements in `vitest.workspace.ts` (skipped thresholds when `CHECK_NO_COVERAGE=1`) |
| Sample graft check | `pnpm craft-check-graft grafts/sample-hello` (LLD §17; fails naming the graft and rule) |
| Secrets | `gitleaks detect --no-git --redact` |
| Perf budgets (CI and milestone ends, not every task) | `pnpm perf` against `tools/perf/budgets.json` (LLD §17) |
| End-to-end (Tester, per task with UI) | `pnpm playwright test` |
