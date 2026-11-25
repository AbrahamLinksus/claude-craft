# Claude Craft – Spec v2 (owner's original, verbatim)

Nov 25, 2026 · @jake

## Overview
Craft is a terminal-styled workstation for running Claude: a small core with two modes, TALK and LAB, where every feature beyond one chat session is a graft you add, tune or remove. It uses the Claude Agent SDK for the agent loop, and gives each session its own git worktree and branch.

Pitch: see and control a fleet of Claude agents from one keyboard-first screen.

## Goals for v1
- One Claude session in a terminal-style view: TALK mode to chat, LAB mode to command.
- Parallel sessions, each isolated in its own worktree and branch.
- A live view of what agents change: change feed, branch graph, file ownership.
- Fork, race and pick: run several attempts at one task and keep the best.
- Collision control: an agent cannot silently edit a file another branch is changing.
- Always-visible usage: 5-hour and weekly limits, tokens and cost.
- Sessions that survive a usage-limit stop or a shutdown and resume later.
- A public graft API, with worktrees, git, usage, radar, race and the orchestrator built on it.

Not in v1: multi-user use, a graft marketplace, model providers other than Claude, a real-terminal client (planned after v1).

## Pipeline at a glance
Claude Agent SDK → AgentPort adapter → event log and event bus → core (sessions, interception, graft host) → local socket → UI client. Section 5 breaks down each block.

## Concept: a small core, grafts for the rest
The core stays small and stable. Everything beyond a chat session is a graft, and grafts are possible because the core gives them four primitives.
1. Shared command grammar. Grafts register verbs and objects into one table instead of binding private keys, so learning one graft teaches the next.
2. Event-sourced sessions with fork. Every session is an event log. The core can fork it from any point, with the repo state at that moment. Race and replay are grafts built on this.
3. Tool-call interception. Grafts see an agent's tool calls before they run and can allow, hold or deny them. Radar and budget limits are grafts built on this.
4. Fleet event bus. Events from every session go to one bus, so a graft can reason across sessions, such as detecting two branches editing the same file.

| Core | Grafts |
|---|---|
| Modes, command grammar registry | worktrees, git, usage |
| Session host, AgentPort, event log | keep-warm, radar, race |
| Event bus, interception layer | orchestrator, budget, recorder |
| Graft host and permission checks | user-model, prompts |

Worktrees and branches stay central. Each session gets its own worktree and branch, created by the worktrees and git grafts, which are on by default. Race attempts fork into new branches, and the git graph and radar read them.

## Modes and command grammar
Craft has two modes. In TALK, typing goes to the active Claude session. In LAB, keys act on Craft itself. esc switches to LAB, and i or enter returns to TALK. The statusline shows the mode as a chip: TALK in blue, LAB in amber.

LAB commands are sentences: an optional count, a verb, then an object. 3fs forks this session three times.

| Key | Verb | Added by |
|---|---|---|
| f | fork | core |
| m | merge | git |
| x | stop | core |
| r | resume | core |
| v | review diff | git |
| p | pick winner | race |
| u | undo | core |
| . | repeat last | core |

| Key | Object | Added by |
|---|---|---|
| s | session | core |
| b | branch | git |
| t | task | orchestrator |
| a | attempts | race |

- mb merges the selected branch, xs stops this session, pa picks the race winner.
- qa … q records macro a, and @a replays it.
- After a partial sentence such as 3f, a which-key popup lists what can come next.

Panels are : commands, so single keys stay free for the grammar: :wt, :git, :sessions, :radar, :race, :usage, :graft, :team, :rebase, :prune, :help.

Rules
1. Grafts register verbs and objects into the one table. Two grafts claiming the same key fail at load, not at runtime.
2. Keys inside an open panel (j/k move, q close, enter focus) are scoped to that panel and listed in its footer. The registry checks grammar keys globally and panel keys per panel.
3. Modal prompts, such as an approval or a radar hold, capture all keys until answered, so single-letter answers are never typed as chat text.

## Screens
Ten screens, each drawn on the Claude Craft – Terminal UI canvas.

| Screen | Opened by | Shows |
|---|---|---|
| Startup | app opens | Empty buffer, one prompt, a hint line |
| TALK (single session) | default | Chat and tool output in the centre, file tree with git colours on the right, session tabs on top |
| Parallel | :sessions | One pane per session, with a worktree column |
| Tiling | :sessions (default layout) | Tiles per session plus a live branch-graph tile |
| LAB | esc | Open panels, pending sentence, which-key popup, grammar hint row |
| Git | :git | Trunk with unmerged branches above and merged below, branch list, overlap warnings |
| Orchestrate | :team | Orchestrator chat, phase strip, swimlanes, parallelism strip, task queue, checkpoints |
| Race | :race or 3fs | Attempts side by side with diff, tests and judge score, plus the fork graph |
| Radar | :radar | Overlap hold prompt, file ownership with edit heat, live branch graph, change feed |
| Graft manager | :graft | Installed grafts with dose, the shelf, and the leaflet of the selected graft |

On every screen
- Top bar: 5-hour and weekly limit bars with percent and reset time, tokens, cost.
- Statusline: mode chip, session, model, branch with M/S counts and ahead, session counts.
- Bottom: the input bar in TALK, the command line or hint row in LAB.
- Limit bars turn green, yellow and red as they fill. Defaults: green below 60%, yellow to 85%, red above. The thresholds are a setting.

Look. Terminal-styled, not a real terminal: warm charcoal surfaces, off-white text, clay #d97757 as the accent. Git colours: green committed, yellow staged, red modified or untracked. Model colours: orange Opus, blue Sonnet, teal Haiku.

## Core architecture
A background daemon owns the sessions and a thin client only renders them, so a UI crash or a closed window never stops an agent. The client reconnects and picks up where it was.
1. Agent harness (SDK). The Claude Agent SDK provides the agent loop, tools, permissions, context and resume. Craft does not rebuild it.
2. AgentPort and adapter. The adapter maps SDK messages to Craft's own typed events: AgentText, ToolStarted, ToolFinished, SubagentStarted, TurnFinished, RateLimit. Nothing else imports SDK types, so an SDK change touches one file.
3. Event log. An append-only log per session. It is the source of truth for resume, fork and replay.
4. Event bus. Typed publish and subscribe across all sessions. Queues are bounded. Approvals, tool results and turn-finished events are never dropped. Partial text and spinner ticks may be.
5. Session manager. Creates, pauses, resumes and forks sessions. Each has a model, prompt, worktree and branch. The default cap is 5 parallel sessions, as a setting.
6. Interception layer. Wraps the SDK permission callback. Every tool call passes the graft chain (radar, budget, approvals) and comes out allowed, held or denied.
7. Graft host. Loads grafts, validates their settings, checks their declared permissions, and registers their keys, commands, panels and widgets.
8. Daemon and client. They talk over a local socket. The client renders from a state snapshot plus the event stream.

Dependency rules. Grafts depend on ports, never on the SDK or git directly. Grafts talk to each other only through the bus. A dependency checker enforces both in CI.

## First-party grafts
Six grafts ship installed, and three more sit on the shelf. All use only the public graft API.

| Graft | Does | Adds | Default dose |
|---|---|---|---|
| worktrees | One worktree and branch per session, listed in :wt, orphan cleanup | :wt, worktree column | 3 |
| git | Branch graph, branch list, merge, rebase, prune merged, review diff | :git, verbs m, v, object b | 3 |
| usage | 5-hour and weekly limit bars, tokens, cost, reset times | top bar, :usage | 3 |
| keep-warm | Pings a focused session so its cache stays warm; pings count toward limits | :keep | 1 |
| radar | Watches tool calls, holds an edit that overlaps another branch, tracks file ownership | :radar, hold prompt | 4 |
| race | Forks one task into N attempts, scores them, picks a winner, sends losers to the graveyard | :race, verbs f, p, object a | 3 |
| orchestrator | The dev-team-setup team: phases, swimlanes, task queue, checkpoints | :team, object t | shelf |
| budget | Caps cost or tokens per session and denies tool calls past the cap | :budget | shelf |
| recorder | Records a session timeline for replay | :replay | shelf |

Radar holds an edit when another branch changed the same file. The modal offers a allow and flag, w wait for merge, d deny. Radar can read tool calls, git status and worktree paths. It cannot use the network, read transcripts or start sessions.

Race judges attempts with the project's tests, lint and a judge score. Scores shown in the mockups are placeholders until the judge is built.

Orchestrator is the existing /setup-project dev team run as a graft. It starts with :team, respects a parallelism cap (default 8), and shows tasks that wait on others.

## Graft API
A graft is a package with a manifest and an entry module. It reaches the core only through the graft API, never through core internals.

Manifest fields

| Field | Meaning |
|---|---|
| name, version, apiVersion | Identity and the graft API version it targets |
| provides | Verbs, objects, : commands, panels, statusline and top-bar widgets, bus events it emits |
| needs | Other grafts or core ports it depends on |
| capabilities | Everything it may do: read tool calls, read git status, read worktree paths, hold or deny tool calls, use the network, read transcripts, start sessions, write files |
| settings | A zod schema for its config, plus the dose mapping |

Leaflet. The capabilities list is shown as a leaflet at install and again whenever an update changes it. A graft cannot use a capability it did not declare. The graft manager shows the leaflet beside each installed graft.

Dose (0–5). Each graft has one dial in place of raw settings: 0 is off, 1 is minimal, 3 is the default, 5 is maximal. Each graft documents what its levels mean, such as radar at 1 only logging overlaps and at 5 holding every cross-branch edit. Raw settings stay available as an advanced view.

Registry checks at load
1. Two grafts claiming the same verb, object, : command or key fail the load, naming both.
2. A missing needs dependency fails the load with an install hint.
3. Settings that fail the schema fall back to defaults and show a warning.
4. A graft that throws is isolated in its own error boundary: its panel shows an error, the rest keeps running.

Versioning. The API is versioned and frozen per major version. The first-party grafts ship against the same API as outside grafts, so the API is tested by real use.

## Data, storage, performance and stability
Storage is plain files, so nothing needs a database server.

| Path | Holds |
|---|---|
| ~/.craft/config | Settings, graft doses, profile |
| ~/.craft/prompts | Saved prompts and temperaments |
| ~/.craft/usage | Usage history |
| ~/.craft/worktrees/<repo>/<session> | Session worktrees, outside the repo so they never show as untracked |
| .craft/sessions/<id>.jsonl | Append-only event log per session |

Logs are written atomically. A crash loses at most the last event. Config, session files and graft task files are validated with zod on load.

Usage data. Limits come from the SDK's rate_limit_event (status, resetsAt, rateLimitType, utilization). The adapter reads it defensively, since its shape may change, and the bars show "unknown" when it is missing.

Halt and resume. A session that hits a limit or is stopped is saved as cryo. Craft shows the reset time and can resume it, with context, once the limit resets.

Performance targets
- Input latency under 50 ms with 5 sessions streaming.
- UI updates batched to about 30 per second.
- Long transcripts virtualized, so only visible lines render.
- Git status runs in a worker with --porcelain=v2 -z --no-optional-locks, and file watching is debounced.
- CI fails a build that breaks a performance budget.

Stability
- An error boundary around every graft and panel.
- A watchdog on event-loop lag.
- SDK child processes are cleaned up on exit, and orphan worktrees are garbage-collected.
- A replay harness re-runs recorded event logs through the core.
- A soak test runs 5 sessions for 1 hour before each release.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Same language as the Agent SDK and the UI |
| Agent loop | Claude Agent SDK (TypeScript) | Tools, permissions, resume; not rebuilt |
| Daemon | Node or Bun process | Owns sessions, worktrees, usage, event log |
| IPC | Unix socket, JSON messages | Client can crash or be swapped without stopping agents |
| Client | Tauri or Electron with React | Terminal-styled desktop app; graphs on canvas or SVG |
| Terminal look | Mono grid, fixed cell size, theme tokens | Looks like a terminal without being one |
| Git | git CLI in a worker | Worktrees, status, branches, merge |
| Validation | zod | Config, sessions, graft task files |
| Architecture checks | dependency-cruiser | Enforces the dependency rules in CI |
| Tests | vitest, plus the replay harness | Core logic and recorded sessions |

Open choice: Tauri or Electron. Tauri is lighter, Electron has the more predictable Node story for the daemon. Decide in milestone 1 with a small spike.

Later: a TUI client. Because the daemon is separate, a real terminal client (Ink or OpenTUI) can be added behind the same socket without touching the core.

## Build order
Each milestone ends with something runnable. The core scaffolding comes first so every later piece lands in the right place.

| # | Milestone | Exit criteria |
|---|---|---|
| 1 | Skeleton and spikes | Daemon and client talk over the socket; Tauri vs Electron decided; SDK spike streams one session and reads rate_limit_event |
| 2 | Core scaffolding | Graft registry with collision checks, AgentPort adapter, event log, bus, dependency-cruiser rules failing CI on violations |
| 3 | Single session | TALK mode chat with tool output, file tree, statusline; session survives a client restart |
| 4 | LAB and grammar | Modes, counts, verbs, objects, which-key popup, : commands, macros |
| 5 | Worktrees and git | One worktree and branch per session; branch graph; merge, rebase, prune, review diff |
| 6 | Parallel and tiling | Up to 5 sessions, tabs, parallel and tiling layouts |
| 7 | Usage and halt/resume | Limit bars, cost, cryo and resume after reset |
| 8 | Interception and radar | Tool calls pass the chain; overlap hold prompt works end to end; file ownership view |
| 9 | Fork and race | Fork from any turn, N attempts, scores, pa pick, graveyard |
| 10 | Graft manager | Dose dials, leaflets, shelf, install and remove, keep-warm |
| 11 | Orchestrator graft | :team runs the dev-team-setup flow with phases, lanes and checkpoints |
| 12 | Hardening | Replay harness, 1-hour soak test with 5 sessions, performance budgets in CI |

Order rationale. Registry and architecture checks come in milestone 2 because retrofitting them later means rewriting grafts. Race comes after interception and the event log because it depends on both.

## Risks, spikes and decisions

| Risk | Impact | Mitigation |
|---|---|---|
| Agent SDK terms for plan login inside third-party apps are unclear | Could block use with a subscription | Check the terms before milestone 3; fall back to API-key use |
| rate_limit_event shape changes | Usage bars break | Defensive reader, "unknown" state, contract test |
| Anthropic ships similar features | Overlap with the core | Keep the novelty in the grammar, fork/race and radar, not in basics |
| Scope: 12 milestones | Never reaches a usable v1 | Milestones 1 to 7 already give a usable single-user tool |
| Unverified spikes | Wrong stack or design | Run the spikes below in milestone 1 |
| Empty graft ecosystem | Looks like a closed tool | First-party grafts use the public API; publish a sample graft |
| Keep-warm pings use limits | Drains the 5-hour allowance | Low default dose; focused session only |

Spikes (milestone 1)
1. Does the SDK expose enough to fork a session at a past turn and restore repo state?
2. Does the permission callback let radar hold a call for minutes without timing out?
3. Are rate_limit_event fields stable and complete enough for both bars?
4. Tauri or Electron: memory use with 5 streaming sessions and a branch graph on canvas.
5. Can 5 parallel SDK subprocesses be cleaned up reliably on crash?

Decisions to make
- Judge for race: tests and lint only, or a model-based score as well.
- Whether a sample graft ships in the repo or as a separate template.
- Name: Claude Craft or Craft, given the Claude trademark.
