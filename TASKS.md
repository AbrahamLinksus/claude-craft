# TASKS — claude-craft (product: Craft)

Status: Backlog → In progress → Review → Needs you → Done

A task is one user-visible feature slice end to end (data, logic, UI, tests), never one layer.
Only the first task may be a foundation task (the app starts and shows its first screen; shared
helpers). Caps by size: small 8, medium 15, large 30; an extra task carries `Why separate:`.
Size: large (cap 30) · 30 tasks · 12 milestones (owner-approved, D-05; checkpoints ★ at M1, M2, M3, M12).

Every task needs `Owner:`, `Depends on:` (real data or interface dependencies only, never a
preferred order; `—` for none) and `Files:` (paths or globs it will create or change): the build
schedules from them (`taskgraph.py`), running tasks with no dependency and no shared files at
the same time.

`Files:` is the task's **claim**: while it runs, no other task's agent may write those paths (the
scope guard enforces it). `Frozen:` lists the shared code the foundation builds; after it, only a
task that claims a frozen path itself may change it. Work that touches every feature is one
wire-up task at the end, not an edit inside each feature.

Frozen: packages/protocol/src/**, packages/graft-api/src/**, packages/graft-ui/src/**, packages/daemon/src/main.ts, packages/daemon/src/domain/**, packages/daemon/src/bus/**, packages/daemon/src/store/**, packages/daemon/src/server/**, packages/daemon/src/log/**, packages/daemon/src/prompts/**, packages/daemon/src/grafts/**, packages/client/src/main/**, packages/client/src/preload/**, packages/client/src/renderer/app.tsx, packages/client/src/renderer/state/**, packages/client/src/renderer/theme/**, packages/client/src/renderer/shell/**, packages/client/src/renderer/panels/host.tsx, packages/daemon/tests/_support/**, packages/client/tests/_support/**, tools/replay/**, tsconfig*.json, eslint.config.js, .dependency-cruiser.cjs, vitest.config.ts, playwright.config.ts, scripts/check.sh, tools/perf/budgets.json

Frozen paths are built by T-01 (foundation) and by the M2 shared-code tasks T-04, T-05, T-06 (each claims its frozen part); T-28 is the hardening shared-code task that claims `tools/replay/**` and `tools/perf/budgets.json`. No feature task (M3 onwards) claims a frozen path. Registries are one file per entry (graft = folder, screen = folder, core `:` command = `packages/daemon/src/grammar/commands/<name>.ts`), so features add files instead of editing shared ones.

`Context:` lists exactly what the task's agents need to read: spec stories, LLD sections
(by number) and file globs. The Orchestrator builds every brief's `Read:` field from it.

## M1 · Skeleton and spikes ★ (checkpoint: stack locked)

### T-01 · Foundation: Craft opens, starts its background worker and shows Startup
- Owner: backend-coder, frontend-coder
- Depends on: —
- Files: packages/protocol/src/**, packages/daemon/src/main.ts, packages/daemon/src/*/index.ts, packages/daemon/src/domain/**, packages/daemon/src/bus/**, packages/daemon/src/store/**, packages/daemon/src/server/**, packages/daemon/src/log/**, packages/daemon/tests/_support/**, packages/daemon/tests/{protocol,domain,bus,store,server}/**, packages/client/src/main/**, packages/client/src/preload/**, packages/client/src/renderer/app.tsx, packages/client/src/renderer/state/**, packages/client/src/renderer/theme/**, packages/client/src/renderer/input/index.ts, packages/client/src/renderer/screens/startup/**, packages/client/tests/_support/**, packages/client/tests/{link,state}/**, packages/client/tests/e2e/foundation.spec.ts, .env.example
- Context: SPEC US-01, US-17, US-32 · LLD §0, Frozen after the foundation, §1, §2, §3, §5, §16 · files: package.json, pnpm-workspace.yaml, packages/*/package.json
- Status: Backlog
- Acceptance criteria:
  - [ ] Launching the client starts the daemon detached (if not running), completes the token handshake over `\\.\pipe\craft-<user>` and shows the Startup screen (empty recent-repos list, "o open folder…", hint line) on the mono grid with theme tokens; killing the client leaves the daemon running, and relaunching reconnects (statusline shows "reconnecting" while it retries) (US-17)
  - [ ] Pipe spike on Windows 11: a second daemon start exits 0 ("already running"); a process without the token fails the handshake with `bye UNAUTHORIZED`; `daemon.token` is readable only by the owner (icacls output captured); a malformed or > 1 MB line closes only that connection (G-05)
  - [ ] Protocol package complete per LLD §1 (ids, every core event with its criticality, wire messages and zod-validated `cmd` args, every §16.1 error code with its plain-words template); `main.ts` wires every daemon module through its `index.ts` (modules not built yet are stubs with the LLD's fixed signatures, each module's `commands` export is registered with the router) so later tasks never edit `main.ts`; preload exposes `window.craft` including the folder picker; `renderer/input/index.ts` exports the fixed key-router signature (§13.3) (G-01)
  - [ ] Store: every §5.1 file has a zod schema, defaults and a migration slot; a value saved then read after a daemon restart is identical (G-02); a v0 `settings.json` fixture migrates to the current schema keeping its values, and a file with a newer `schema` or bad JSON falls back to defaults with a warning naming the file, left untouched (G-L2, US-32)
  - [ ] Domain functions (repo-key, numbering, caps, redact, sentence, chain-order, session-fsm) are pure and unit-tested: two repos named `api` with different remotes get repoIds `api` and `api-2`, a repo with no remote is keyed by its lowercased path (S-09); redaction turns `API_KEY=sk-live-4f9…` into `API_KEY=[hidden]` against a golden file; `.env.example` lists `CRAFT_HOME`, `CRAFT_PIPE`, `CRAFT_LOG_LEVEL`, `ANTHROPIC_API_KEY` (G-04)
- Result:

### T-02 · Agent SDK spikes 1, 2, 3, 5 and sign-in on Windows
- Owner: agent-engineer
- Depends on: —
- Files: spikes/sdk/**, docs/spikes/sdk.md
- Context: SPEC US-16, US-19, US-21, US-31, §8 · LLD §0.7, §6, §8.3 · files: spikes/sdk/*
- Status: Backlog
- Acceptance criteria:
  - [ ] Spike 1: `forkSession` at turn N then `resume` in a different worktree cwd continues from turn N (pass/fail and the chosen §0.7 branch recorded in `docs/spikes/sdk.md`)
  - [ ] Spike 2: a `PreToolUse` hook and a `canUseTool` call each held 10 minutes then allowed proceed, or the hidden timeout is measured and recorded
  - [ ] Spike 3: `rate_limit_event` captured under both sign-in methods; the observed shape (both windows, units, missing fields) saved as fixtures in `spikes/sdk/fixtures/` for the adapter's contract tests
  - [ ] Spike 5: killing the daemon (Task Manager "End task" and `taskkill /F`) with 5 sessions each running a tool child leaves no `claude`/tool processes; the reaper tier (A, B or C) is chosen with evidence
  - [ ] Sign-in: a session starts with the `claude-login` path using the bundled, unmodified binary; the not-signed-in and refused error shapes are recorded and mapped to `AUTH_MISSING`/`AUTH_REJECTED`
- Result:

### T-03 · Spike 4: Electron vs Tauri on Windows 11
- Owner: frontend-coder, devops
- Depends on: —
- Files: spikes/shell/**, docs/spikes/shell.md
- Context: SPEC §9 (latency), §10 · LLD §0.1, §0.7, §13.4, §17 · files: spikes/shell/*
- Status: Backlog
- Acceptance criteria:
  - [ ] Both shells render 5 replayed streaming transcripts plus a canvas branch graph on the mono grid; keystroke-to-paint p95 and memory are measured on Windows 11 and tabled in `docs/spikes/shell.md`
  - [ ] Electron passes keystroke-to-paint p95 < 50 ms, or the report recommends Tauri with the §0.7 consequence (only `client/src/main/` is rewritten) as an owner decision
  - [ ] How each shell's main process reaches the named pipe is shown working in the spike (a round trip of one JSON line)
- Result:

## M2 · Core scaffolding ★ (checkpoint: graft API v1 and event format locked)

### T-04 · Command plumbing: grammar registry, prompt queue, undo journal
- Owner: backend-coder
- Depends on: T-01
- Files: packages/daemon/src/grammar/**, packages/daemon/src/prompts/**, packages/daemon/src/undo/**, packages/daemon/tests/{grammar,prompts,undo}/**
- Context: SPEC US-04, US-05, US-08, US-30, US-34 · LLD §9, §10, §16.1 · files: packages/protocol/src/*, packages/daemon/src/main.ts
- Status: Backlog
- Acceptance criteria:
  - [ ] The grammar table in the snapshot lists core verbs `f x r u .` and object `s` with owners; registering key `p` twice fails with "Key p claimed by race and my-graft" and the second registration is not added (US-30, S-15)
  - [ ] Prompt queue: two holds and one approval asked at once show one at a time as "1 of 3 · s2 wants to edit src/db.ts …" in arrival order; answering resolves only the prompt on screen and the next shows "2 of 3"; a key not among its options keeps it open (`INVALID_KEY`) (US-08, S-04, G-05)
  - [ ] Undo journal keeps the last 20 entries in `state/undo.json` and still has them after a daemon restart (G-02); an entry whose sha is reachable from a remote-tracking ref returns "already pushed, can't undo" and changes nothing; a missing handler returns "turn on <graft> to undo this" (US-34, G-01)
  - [ ] `sentence.run` and `command.run` reach the owning handler and return `RunResult`; a thrown `CraftError` becomes `reply {ok:false}` with the plain-words message, never a stack trace (G-01)
- Result:

### T-05 · Graft host, graft API v1, sample graft and architecture checks in CI
- Owner: backend-coder, devops
- Depends on: T-04
- Files: packages/graft-api/src/**, packages/daemon/src/grafts/**, packages/daemon/tests/_support/test-graft-host.ts, packages/daemon/tests/grafts/**, grafts/sample-hello/**, tools/check-graft/**, .dependency-cruiser.cjs, .github/workflows/ci.yml
- Context: SPEC US-24, US-29, US-30 · LLD §0.3, §11, §15.10, §17 · files: packages/protocol/src/*, packages/daemon/src/grammar/index.ts, packages/daemon/src/prompts/index.ts
- Status: Backlog
- Acceptance criteria:
  - [ ] `grafts/sample-hello` loads from its manifest, registers verb `h` (binding `hs`) and panel `:hello`; `hs` on s2 publishes the Notice "hello from sample-hello to s2" and the panel's count goes up (US-29)
  - [ ] `pnpm craft-check-graft grafts/sample-hello` passes in CI on every push; changing the sample graft to import git directly fails the build naming `sample-hello` and "grafts use the public API only" (US-29)
  - [ ] Load checks: a missing need fails with "radar needs worktrees: install it from the shelf (:graft)"; bad graft settings fall back to defaults with a warning; a graft that throws in a handler is marked `error` while the other grafts keep running (US-30, S-15, G-01)
  - [ ] A graft using a capability it did not declare is blocked with "<graft> tried to <capability> without declaring it"; a graft whose capabilities differ from the accepted ones waits as `awaiting-leaflet` until a `y` on the leaflet prompt (US-24)
  - [ ] Dose 0 keeps a graft installed but off; dose changes call `onDose` or deactivate/activate across 0; install-from-shelf and remove update `config/grafts.json` (US-23)
- Result:

### T-06 · Client shell: top bar, statusline, tabs, prompt overlay, which-key and panel host
- Owner: frontend-coder
- Depends on: T-01
- Files: packages/graft-ui/src/**, packages/client/src/renderer/shell/**, packages/client/src/renderer/panels/host.tsx, packages/client/tests/shell/**
- Context: SPEC US-05, US-08, US-11, US-14, US-15, US-30, §7 · LLD §13.2, §13.4, §13.5, §14 · files: packages/client/src/renderer/{app.tsx,state/*,theme/*}, packages/protocol/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] Statusline renders a session view as `TALK · notes-app · s1 · Sonnet · craft/s1 M1 S0 ↑0 · 1 session` with the TALK chip blue (LAB amber) and model colours orange Opus / blue Sonnet / teal Haiku (US-15)
  - [ ] PromptOverlay shows the queue head as "1 of 3" with the session named first; WhichKey renders a `partial` parse's next keys with name and owning graft (`s session (core) · a attempts (race)`) (US-05, US-08, S-04)
  - [ ] TopBar and Statusline draw graft widgets in their slots; SessionTabs show every session on session screens (US-11, US-14)
  - [ ] A panel that throws shows "<graft> panel failed: <message>" in its own box while the rest of the window keeps working (US-30, S-15, G-01)
  - [ ] `graft-ui` exports `Grid, Box, Text, Chip, Bar, List, Table, Canvas, theme` and the panel/widget props; no component outside `theme/` uses raw pixels or colour literals (lint check)
- Result:

### T-07 · AgentPort, SDK adapter and process reaper
- Owner: agent-engineer
- Depends on: T-01, T-02
- Files: packages/daemon/src/agent/**, packages/daemon/src/process/**, packages/daemon/tests/{agent,process}/**, packages/daemon/tests/fixtures/sdk/**
- Context: SPEC US-02, US-16, US-18, §8 · LLD §6.1, §6.2, §6.4, §0.7 · files: docs/spikes/sdk.md, spikes/sdk/fixtures/*, packages/protocol/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] Contract tests feed the spike's recorded SDK messages through the adapter and get `AgentText`, `ToolStarted` (with relative paths), `ToolFinished`, `SubagentStarted`, `TurnFinished` (tokens, cumulative cost, lastMessageId) and `RateLimit` per §6.2; a rate-limit message missing a window omits it and never throws
  - [ ] Error classification maps auth failure → `AUTH_REJECTED`, rate limit → `LIMITED` with `resetsAt`, `ECONNRESET`/`ENOTFOUND`/overloaded → `OFFLINE`, anything else → `AGENT_ERROR` (G-01)
  - [ ] The `PreToolUse` hook calls the injected `ToolGate` for every tool call and `canUseTool` calls the `ApprovalGate`; with the SDK's import only in `agent/sdk-adapter/` (depcruise passes) (US-18)
  - [ ] Every spawned child is recorded in `state/children.json`; at daemon start `sweepOrphans()` kills recorded leftovers whose creation time matches and never a reused PID (reaper tier from spike 5)
- Result:

### T-08 · Event log: per-session history files, redaction and 50 MB parts
- Owner: backend-coder
- Depends on: T-01
- Files: packages/daemon/src/eventlog/**, packages/daemon/tests/eventlog/**
- Context: SPEC US-17, US-21, US-28, US-33, §6, §13 · LLD §4, §1.1, §1.2 · files: packages/daemon/src/domain/redact.ts, packages/protocol/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] A "yes" repo's log is written to `<worktree>/.craft/sessions/s3.jsonl` and a "no" repo's to `~/.craft/sessions/<repoDir>/s3.jsonl`, never inside the repo (US-33, S-06)
  - [ ] In a "yes" repo, a tool output `API_KEY=sk-live-4f9…` is saved as `API_KEY=[hidden]` (US-33, S-06)
  - [ ] Writing past 50 000 000 bytes continues in `s3.2.jsonl`; no part ever exceeds 50 MB and each part starts with a `LogHeader` (US-33, S-06)
  - [ ] A log whose last line was torn by a crash reopens with that line removed and every earlier line intact (crash loses at most the last event) (G-02)
  - [ ] `turnPoint(sid, 4)` returns turn 4's lastMessageId and commit sha; `read()` streams lines from a given `n`
- Result:

## M3 · Single session ★ (checkpoint: first end-to-end flow)

### T-09 · Git port, git worker, and each session gets its own worktree
- Owner: backend-coder
- Depends on: T-05
- Files: packages/daemon/src/git/**, packages/daemon/tests/git/**, grafts/worktrees/**
- Context: SPEC US-09, US-02, §6 · LLD §12, §15.1, §7.1 (WorkspacePort) · files: packages/graft-api/src/*, packages/daemon/tests/_support/*
- Status: Backlog
- Acceptance criteria:
  - [ ] Every `GitRead`/`GitWrite` operation runs in the worker against real temp repos; writes for one repo run one at a time; `status` excludes `.craft/`; git missing → "git not found: install Git for Windows" (G-01)
  - [ ] `WorkspacePort.create` makes `~/.craft/worktrees/notes-app/s1` on `craft/s1` from the main checkout's last commit, locked, and the main checkout shows no untracked files from it (US-09)
  - [ ] Two repos both named `api` (different remotes) get worktrees under `worktrees/api/` and `worktrees/api-2/` (US-09, S-09)
  - [ ] With 2 uncommitted files in the main checkout, `create` succeeds and returns those 2 paths in `uncommittedInMain` (S-12)
  - [ ] An edit inside a live worktree publishes `GitStatusChanged` within about 250 ms of the last change (debounced)
- Result:

### T-10 · Startup: pick a repo, sign in, settings panel
- Owner: backend-coder, frontend-coder
- Depends on: T-04, T-06, T-09
- Files: packages/daemon/src/sessions/**, packages/daemon/src/auth/**, packages/daemon/src/grammar/commands/repo.ts, packages/daemon/src/grammar/commands/settings.ts, packages/daemon/tests/{sessions,auth}/**, packages/client/src/renderer/screens/startup/**, packages/client/src/renderer/screens/settings/**, packages/client/tests/{startup,settings}/**, packages/client/tests/e2e/startup.spec.ts
- Context: SPEC US-01, US-31, US-32, F-1, F-10 · LLD §5.1–§5.3, §6.3, §7.1, §7.3, §13.5 · files: packages/daemon/src/store/*, packages/client/src/renderer/shell/*
- Status: Backlog
- Acceptance criteria:
  - [ ] Startup lists recent repos most recent first as "1 notes-app  C:\Users\Jake\code\notes-app · 2 craft-site … · 3 api  D:\work\api · o open folder…"; `1` or j/k + enter picks one and the statusline shows `TALK · notes-app · …`; a recent repo whose folder is gone shows greyed "missing" with `x` to forget it (US-01, S-01)
  - [ ] Opening a folder that is not a git repo shows "not a git repo: <path>"; a repo with no commits shows "scratch has no commits yet: make a first commit, then start a session"; nothing starts (US-01, S-12, G-01, G-05)
  - [ ] `:settings` shows "Sign-in: subscription"; switching to API key and pasting `sk-ant-api03-…x7Qa` shows "Sign-in: API key (…x7Qa)"; the key is saved only in `credentials.json`, never in `config/` or a tracked file; a key not starting `sk-ant-` is refused (US-31, S-14, G-04, G-05)
  - [ ] With no sign-in or a refused one, starting a session shows how to fix it ("sign in through Claude's own sign-in, or switch to an API key in :settings") and no session is created (US-31, S-14, G-01)
  - [ ] Settings changed in `:settings` (cap, thresholds, review on/off, offline retry minutes) are still set after quitting and reopening Craft; `:repo` returns to the repo list (US-32, G-02)
- Result:

### T-11 · TALK: chat with one session in its own worktree
- Owner: backend-coder, frontend-coder
- Depends on: T-07, T-08, T-10
- Files: packages/daemon/src/sessions/**, packages/daemon/tests/sessions/**, packages/client/src/renderer/screens/talk/**, packages/client/tests/talk/**, packages/client/tests/e2e/talk.spec.ts
- Context: SPEC US-02, US-09, US-15, US-17, US-33, F-1 · LLD §7, §4.1, §6.1, §13.2, §13.5 · files: packages/daemon/src/{agent,eventlog,sessions}/index.ts, grafts/worktrees/*
- Status: Backlog
- Acceptance criteria:
  - [ ] Typing "Add a --verbose flag to cli.ts" + enter in `notes-app` starts `s1` on `craft/s1` in `~/.craft/worktrees/notes-app/s1`; agent text and tool output stream into the centre pane (virtualized) and `src/cli.ts` shows red in the file tree (US-02, US-09)
  - [ ] The first session in a repo asks "Push session histories for notes-app? y yes · n no (keep on this computer)"; `n` → history in `~/.craft/sessions/notes-app/` and the repo has no `.craft/sessions`; the answer is remembered by remote address, so a copied `config/repos.json` applies it to the same repo at `C:\dev\api` but not to `C:\oss\api` (US-33, S-06, S-09)
  - [ ] Session numbers count up per repo and are never reused: after s1–s6 the next session is `s7`; with 2 uncommitted files in the main checkout it starts and says "your 2 uncommitted files are not in s7" (US-09, S-12, S-13)
  - [ ] Closing (or killing) the client mid-stream and reopening shows the session still running with every event that happened meanwhile (US-17)
- Result:

## M4 · LAB and grammar

### T-12 · LAB mode: sentences, which-key, repeat, macros and `:` commands
- Owner: frontend-coder
- Depends on: T-04, T-05, T-06
- Files: packages/client/src/renderer/input/**, packages/client/src/renderer/screens/lab/**, grafts/sample-hello/ui/**, packages/client/tests/{input,lab}/**, packages/client/tests/e2e/lab.spec.ts
- Context: SPEC US-03–US-08, US-29, F-2 · LLD §13.3, §10.2, §10.3, §14 · files: packages/client/src/renderer/shell/*, packages/client/src/renderer/input/index.ts
- Status: Backlog
- Acceptance criteria:
  - [ ] esc shows the amber LAB chip, i or enter the blue TALK chip; in LAB no keystroke reaches the chat (US-03)
  - [ ] Typing `3f` shows the which-key popup `s session (core) · a attempts (race)`; `3fs` sends `sentence.run {count:3, verb:f, object:s}`; `xs` and `mb` send theirs; `.` repeats the last sentence; an invalid key cancels the sentence with a one-line hint and nothing runs (US-04, US-05, G-05)
  - [ ] `qa xs q` records macro a and `@a` replays the same keys through the router (US-06)
  - [ ] `:hello` opens the sample graft's panel; `:` commands open their panel and the panel footer lists its keys (j/k, q, enter) (US-07, US-29)
  - [ ] While a prompt is open, typing `a` answers it and nothing is sent to the session; typing-to-echo stays under 50 ms (Playwright timing) (US-08)
- Result:

## M5 · Worktrees and git

### T-13 · Per-turn commits, `:wt` and unknown worktrees
- Owner: backend-coder, frontend-coder
- Depends on: T-11
- Files: grafts/worktrees/**
- Context: SPEC US-09, US-17, §6, §13 · LLD §15.1, §7.3 (turn end, recovery), §12.1 · files: grafts/worktrees/*, packages/graft-api/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] When `s2` finishes turn 4 after editing `src/db.ts` and `src/db.test.ts`, `craft/s2` gets the commit `craft s2 · turn 4: Fix failing date parser test` and the statusline shows `craft/s2 M0 S0 ↑4`; a turn that changed nothing adds no commit (US-09, S-03)
  - [ ] `:wt` lists each session's worktree path, branch, locked and dirty state; the worktree column widget shows in the fleet layouts (US-09)
  - [ ] After a restart with an unknown folder `~/.craft/worktrees/notes-app/s9`, Craft asks "1 unknown worktree: notes-app/s9 · d delete · k keep"; `k` keeps it, `d` deletes it, and no worktree of a known session (cryo included) is ever touched (US-17, S-05, G-03)
- Result:

### T-14 · Git view, merge with confirm and undo, review diff
- Owner: backend-coder, frontend-coder
- Depends on: T-13, T-19
- Files: grafts/git/**
- Context: SPEC US-12, US-13, US-15, US-34, F-4 · LLD §15.2, §12.1, §10.4, §7.1 · files: grafts/git/*, packages/graft-api/src/*, packages/graft-ui/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] `:git` shows trunk with unmerged branches above and merged below, a branch list and overlap warnings for files changed on 2+ unmerged branches; `vb` shows the branch diff (US-12, US-13)
  - [ ] `mb` on `craft/s2` asks "Merge craft/s2 into main (3 commits)? y/n"; `y` moves `craft/s2` to merged-below and main's ahead count +1; `u` puts it back above trunk with main as before (US-34, G-03)
  - [ ] `mb`, `y`, then the owner commits "fix typo in README" on main, then `u` → main gets "Undo merge of craft/s2", the README commit stays, `craft/s2` shows unmerged; `u` after main was pushed shows "already pushed, can't undo" and changes nothing (US-34, S-03, G-03)
  - [ ] `mb` on `craft/s5` while turn 5 runs asks "turn 5 still running, not included · y merge 4 turns · w wait for turn end · n cancel"; `w` merges all 5 turns after the turn's commit; merging a working session pauses it, merges and resumes it (US-13, US-34, S-16)
  - [ ] A merge conflict stops with "merge stopped: <files> conflict; craft/s2 unchanged", the branch is as before and a paused session resumes (US-13, G-01)
- Result:

### T-15 · Rebase and prune with confirm and undo
- Owner: backend-coder
- Depends on: T-14
- Files: grafts/git/**
- Context: SPEC US-13, US-34, F-4 · LLD §15.2, §12.1, §10.4 · files: grafts/git/*
- Status: Backlog
- Acceptance criteria:
  - [ ] `:rebase` on `craft/s3` while `s3` is mid-turn pauses it; when main also changed `src/parser.ts` it shows "rebase stopped: src/parser.ts conflicts; craft/s3 unchanged" and `s3` resumes (US-13, S-11)
  - [ ] `:prune` offers only merged branches; the confirm reads "Prune 4 branches and worktrees? Untracked files lost: craft/s4: .env · y/n", and an ignored `node_modules/` shows as one line "node_modules/ (40 112 files, ignored)" (US-34, S-13)
  - [ ] After a confirmed prune, `u` brings back the branches and their worktrees (G-03, S-13)
  - [ ] Pruning or dropping a branch publishes `git/branch-dropped` and merging publishes `git/branch-merged` (radar and race rely on them)
- Result:

## M6 · Parallel and tiling

### T-16 · Fleet: up to 5 sessions, Parallel and Tiling layouts
- Owner: backend-coder, frontend-coder
- Depends on: T-13, T-14
- Files: packages/daemon/src/sessions/**, packages/daemon/src/grammar/commands/sessions.ts, packages/daemon/tests/sessions/**, packages/client/src/renderer/screens/parallel/**, packages/client/src/renderer/screens/tiling/**, packages/client/tests/{parallel,tiling}/**, packages/client/tests/e2e/fleet.spec.ts
- Context: SPEC US-10, US-11, F-3 · LLD §7.1, §7.3 (caps), §13.5 · files: packages/daemon/src/domain/caps.ts, packages/client/src/renderer/shell/*
- Status: Backlog
- Acceptance criteria:
  - [ ] 5 sessions stream at once; a 6th is refused with "5 of 5 sessions running; raise the cap in settings or stop one (xs)"; raising the cap in settings allows it (US-10, G-01)
  - [ ] Team-pool sessions do not count toward the own cap: with 2 own sessions running, 8 team sessions can start and a 9th waits (US-10, US-26, S-10)
  - [ ] `:sessions` opens Tiling (tiles per session + live branch-graph tile) by default and can switch to Parallel (one pane per session + worktree column); tabs show on top of every session screen (US-11)
  - [ ] A failed worktree creation (e.g. disk full) starts no session and shows the error (G-01)
- Result:

## M7 · Usage and halt/resume

### T-17 · Usage bars
- Owner: backend-coder, frontend-coder
- Depends on: T-05, T-06, T-07
- Files: grafts/usage/**
- Context: SPEC US-14, F-5 · LLD §15.3, §1.2 (RateLimit, TurnFinished), §14 · files: grafts/usage/*, packages/graft-api/src/*, packages/graft-ui/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] RateLimit five_hour 0.72 resets 17:40 → 5-hour bar yellow "72% · resets 17:40"; green below 60 %, red above 85 %, thresholds from settings; tokens and cost show on the top bar of every screen (US-14)
  - [ ] A window missing from the SDK shows "unknown" (US-14)
  - [ ] With the last figure older than 5 minutes or past its reset time, both bars turn grey with "out of date · last seen 14:02" until new data arrives (US-14, S-08)
  - [ ] Usage history lines append to `~/.craft/usage/history-YYYY-MM.jsonl` and are read back after a restart (US-32, G-02)
- Result:

### T-18 · Cryo, resume, offline retry and crash recovery
- Owner: backend-coder, agent-engineer
- Depends on: T-11
- Files: packages/daemon/src/sessions/**, packages/daemon/tests/sessions/**, packages/client/tests/e2e/cryo.spec.ts
- Context: SPEC US-16, US-17, F-5 · LLD §7.2, §7.3 (resume, offline, recovery), §6.2 (classification), §16.2 · files: packages/daemon/src/sessions/*, packages/daemon/src/agent/index.ts
- Status: Backlog
- Acceptance criteria:
  - [ ] A session hitting the weekly limit shows "cryo · resumes after Mon 09:00"; `rs` after that time continues the same conversation in the same worktree; `rs` earlier tries, and if refused stays cryo with "still limited · resumes after Mon 09:00" (US-16, S-07, G-01)
  - [ ] With the network cut for 6 minutes mid-turn, each session shows "retrying…" for about 5 minutes (setting), then "cryo · offline"; `rs` once back online continues it; the git view, logs and graft manager keep working offline (US-16, S-08, G-L1)
  - [ ] After the daemon is killed with s1, s2 cryo, s3 mid-turn and s4 idle with uncommitted edits, the next start shows all four cryo, s3 "cryo · interrupted mid-turn", s4's edits still in its worktree; `rs` on s3 continues its task (US-17, S-05)
  - [ ] `xs` stops a session into cryo "stopped" and `rs` resumes it (US-04, US-16)
- Result:

## M8 · Interception and radar

### T-19 · Interception chain
- Owner: agent-engineer
- Depends on: T-04, T-07, T-11
- Files: packages/daemon/src/intercept/**, packages/daemon/src/sessions/control.ts, packages/daemon/tests/intercept/**
- Context: SPEC US-18, US-08, US-13 (G-14 pause) · LLD §8, §7.1 (pause/unpause/whenTurnEnds), §9 · files: packages/daemon/src/{agent,prompts,sessions}/index.ts
- Status: Backlog
- Acceptance criteria:
  - [ ] Every tool call is logged as `ToolDecision` allowed, held or denied with the deciding graft (or `owner`) in the session log (US-18)
  - [ ] Interceptors run in phase order guard → pause → collision → budget → policy; an edit under `.craft/` is denied by the guard
  - [ ] An interceptor that throws or answers nothing within 2 s holds the call and asks "s2: <graft> crashed while checking Edit src/db.ts · a allow · d deny"; no error path ever allows the call (G-01)
  - [ ] `pause(sid)` lets running tool calls finish and holds new ones until `unpause`; `whenTurnEnds` resolves after the turn's commit; a tool call needing permission goes to the approvals prompt (US-08, US-13)
- Result:

### T-20 · Radar: collision holds and the radar panel
- Owner: backend-coder, frontend-coder
- Depends on: T-14, T-19
- Files: grafts/radar/**
- Context: SPEC US-19, US-20, F-6 · LLD §15.5, §8.2, §8.3, §11.2 · files: grafts/radar/*, packages/graft-api/src/*, packages/graft-ui/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] `s2` editing `src/db.ts`, changed on `craft/s3`, opens "s2 wants to edit src/db.ts — also changed on craft/s3. a allow+flag · w wait for merge · d deny"; `a` lets the edit through and flags it, `d` denies it with the reason shown to the agent (US-19)
  - [ ] After `w`, merging `craft/s3` lets the edit proceed; if `craft/s3` instead goes to the graveyard, is pruned or its session is stopped, the prompt reopens first in the queue with "craft/s3 was dropped, not merged" (US-19, S-04)
  - [ ] Dose 1 only logs overlaps; dose 5 holds every cross-branch edit (US-19, F-8 example)
  - [ ] `:radar` shows the current hold, files by owning branch with edit heat, the live branch graph and a change feed (US-20)
- Result:

## M9 · Fork and race

### T-21 · Fork from any turn, `3fs`, "Only N fit"
- Owner: backend-coder, agent-engineer
- Depends on: T-13, T-16
- Files: packages/daemon/src/sessions/**, packages/daemon/tests/sessions/**, packages/client/tests/e2e/fork.spec.ts
- Context: SPEC US-04, US-10, US-21, F-7 · LLD §7.4, §7.3 (caps), §4.1 (turnPoint), §6.1 (fork) · files: docs/spikes/sdk.md, packages/daemon/src/sessions/*
- Status: Backlog
- Acceptance criteria:
  - [ ] Forking `s1` at turn 3 creates a session whose conversation continues from turn 3 and whose worktree is at turn 3's commit (a turn without a commit uses the nearest earlier one) (US-21)
  - [ ] `3fs` on `s1` creates `s2 s3 s4`, each a fork of `s1` at its last turn, on `craft/s2..s4` (US-04)
  - [ ] `3fs` with `s1`–`s3` running and cap 5 asks "Only 2 fit: start 2? y/n"; `y` starts `s4`, `s5`; `n` starts nothing (US-10, S-02)
- Result:

### T-22 · Race: attempts side by side, pick a winner
- Owner: backend-coder, frontend-coder
- Depends on: T-14, T-21
- Files: grafts/race/**
- Context: SPEC US-22, US-34, F-7 · LLD §15.6, §6.4 (CommandRunner), §10.4 · files: grafts/race/*, packages/graft-api/src/*, packages/graft-ui/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] A race of 3 on "Fix failing date parser test" shows attempt cards with diff +12/−3, tests 41/41, lint 0, review "off", plus the fork graph; an attempt that crashes is marked failed and the others continue; a project without tests shows "no tests" (US-22)
  - [ ] In `notes-app` with `test:unit` and `lint` scripts the race screen shows "tests: npm run test:unit · lint: npm run lint (guessed · e edit)"; an edited command is remembered for that repo (US-22, S-02)
  - [ ] `pa` on attempt 2 asks to confirm; `y` keeps `craft/s6` and moves s5 and s7 to the graveyard; `u` un-picks and brings the losers back (US-22, US-34, G-03)
- Result:

### T-23 · Race review score (optional, off by default)
- Owner: prompt-engineer, agent-engineer
- Depends on: T-22
- Files: grafts/race/daemon/review/**, grafts/race/tests/review/**, packages/daemon/src/agent/sdk-adapter/review.ts, packages/daemon/tests/agent/review.test.ts
- Context: SPEC US-22, F-7, §9 (cost) · LLD §6.1 (review), §15.6 · files: grafts/race/daemon/*, packages/daemon/src/agent/index.ts
- Status: Backlog
- Acceptance criteria:
  - [ ] With review on in settings, the race screen shows "review on: uses your limits" and each finished attempt gets "review 8/10 · <one-line reason>"; the review's tokens raise the 5-hour bar (US-22)
  - [ ] With review off (default) no review call is made and the column shows "off" (US-22)
  - [ ] A failed review shows "review failed", a limit hit shows "limit reached", and the race still judges on tests + lint (US-22, G-01)
  - [ ] The review prompt and model are pinned in one versioned file in the race graft and produce a 0–10 score with a one-line reason on 3 recorded sample diffs
- Result:

## M10 · Graft manager

### T-24 · Graft manager: doses, leaflets, shelf
- Owner: frontend-coder, backend-coder
- Depends on: T-05, T-06
- Files: packages/client/src/renderer/screens/graft-manager/**, packages/daemon/src/grammar/commands/graft.ts, packages/client/tests/graft-manager/**, packages/client/tests/e2e/graft-manager.spec.ts
- Context: SPEC US-23, US-24, US-32, F-8 · LLD §11.1–§11.3, §13.5 · files: packages/daemon/src/grafts/index.ts, packages/client/src/renderer/shell/*
- Status: Backlog
- Acceptance criteria:
  - [ ] `:graft` lists installed grafts with their dose (0–5), the shelf, and the selected graft's leaflet in plain words (US-23)
  - [ ] Changing radar's dose from 3 to 5 changes its behaviour immediately and is still 5 after restarting Craft; copying `config/` to another `~/.craft` shows the same doses (US-23, US-32, G-02)
  - [ ] Installing a shelf graft shows its leaflet and installs only after `y`; removing a graft removes its keys and panels (US-23, US-24)
- Result:

### T-25 · Keep-warm
- Owner: backend-coder
- Depends on: T-11, T-17
- Files: grafts/keep-warm/**
- Context: SPEC US-25 · LLD §15.4, §11.2 (sessions.prompt) · files: grafts/keep-warm/*, packages/graft-api/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] With keep-warm at dose ≥ 1 the focused idle session is pinged on schedule (dose 1: every 4.5 min while the owner was active in the last 15 min) and only that session (US-25)
  - [ ] Pings are tagged `graft:keep-warm` and their tokens show in the usage bars (US-25)
  - [ ] `:keep` shows the next ping time; dose 0 sends no pings (US-25)
- Result:

### T-26 · Budget and recorder (shelf grafts)
- Owner: backend-coder, frontend-coder
- Depends on: T-08, T-19
- Files: grafts/budget/**, grafts/recorder/**
- Context: SPEC US-27, US-28 · LLD §15.8, §15.9, §8.1, §4.1 · files: grafts/{budget,recorder}/*, packages/graft-api/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] With budget installed and a $5.00 cap, tool calls after `s3` reaches it are denied and the session shows "budget: s3 reached $5.00 cap" (US-27)
  - [ ] With recorder installed, `:replay` picks a past session and steps through its events with j/k; enter jumps to a turn (US-28)
  - [ ] Both stay on the shelf until installed from `:graft` (US-23)
- Result:

## M11 · Orchestrator graft

### T-27 · Orchestrator: run the dev team from `:team`
- Owner: agent-engineer, backend-coder, frontend-coder
- Depends on: T-14, T-16, T-19
- Files: grafts/orchestrator/**
- Context: SPEC US-26, F-9 · LLD §15.7 (and the §15.7.x sections added before this task), §7.3 (pools), §9 · files: grafts/orchestrator/*, packages/graft-api/src/*
- Status: Backlog
- Acceptance criteria:
  - [ ] `:team` shows orchestrator chat, phase strip, swimlanes, parallelism strip (cap 8), task queue with waiting tasks and checkpoints (US-26)
  - [ ] With 2 own sessions running, a plan of 8 independent tasks runs all 8 at once; a 9th waits in the queue (US-26, S-10)
  - [ ] A failing team task shows the failure in its lane and the checkpoint asks what to do (US-26)
- Result:

## M12 · Hardening ★ (checkpoint: before release)

### T-28 · Replay harness, watchdog and performance budgets in CI
- Owner: devops, backend-coder
- Depends on: T-08, T-16, T-17, T-20
- Files: tools/replay/**, tools/perf/**, packages/daemon/src/watchdog/**, packages/daemon/tests/watchdog/**, .github/workflows/ci.yml
- Context: SPEC §9 (latency, stability) · LLD §17, §16.2 · files: tools/*, packages/daemon/src/eventlog/index.ts
- Status: Backlog
- Acceptance criteria:
  - [ ] Replaying a recorded session log through the bus and grafts with a fake clock reproduces the golden panel states and tool decisions
  - [ ] `pnpm perf` fails CI when keystroke-to-paint p95 ≥ 50 ms with 5 replayed streams, renders exceed 30/s, or daemon event-loop p99 ≥ 50 ms
  - [ ] Event-loop lag over 100 ms p99 for 10 s logs and shows a warning Notice at most once a minute
- Result:

### T-29 · Soak test and Windows installer
- Owner: devops
- Depends on: T-16, T-18, T-28
- Files: tools/soak/**, packages/client/electron-builder.yml, .github/workflows/release.yml
- Context: SPEC §9, §12 · LLD §17, §6.4, §0.4 (electron-builder) · files: tools/soak/*, tools/perf/*
- Status: Backlog
- Acceptance criteria:
  - [ ] A 1-hour soak with 5 live sessions on Windows 11 passes: no leaked SDK or tool processes, memory growth < 20 %, typing under 50 ms
  - [ ] The NSIS per-user installer installs Craft, it appears in the Start menu and opens to Startup (G-L3)
- Result:

### T-30 · Wire-up: `:help`, README with copy steps, definition of done
- Owner: backend-coder, docs
- Depends on: T-12, T-15, T-20, T-23, T-24, T-25, T-26, T-27, T-29
- Files: README.md, docs/architecture.md, docs/graft-authors.md, packages/daemon/src/grammar/commands/help.ts, packages/client/tests/e2e/dod/**
- Context: SPEC §12, §13, US-07, US-32, F-10 · LLD §0, §10.3, §11 · files: grafts/sample-hello/*
- Status: Backlog
- Acceptance criteria:
  - [ ] `:help` lists every verb, object and `:` command from the grammar table with its owning graft (US-07)
  - [ ] A fresh clone installs and starts with the README's commands on Windows 11 (G-06, G-L3)
  - [ ] README states the backup choice (histories only in "yes" repos, everything else on this PC with no backup) and the F-10 copy steps, including "the copied usage history replaces the one already on that computer" (G-03, US-32, S-09)
  - [ ] The six SPEC §12 checks pass as end-to-end tests on Windows 11 (live Claude parts with `CRAFT_LIVE=1`)
- Result:
