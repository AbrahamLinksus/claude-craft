# STATE — claude-craft

> Source of truth for resuming. Updated after every task.

| Field | Value |
|---|---|
| Problem | One keyboard-first, terminal-styled screen to see and control a fleet of Claude Agent SDK sessions, each in its own git worktree, with features added as grafts |
| Repo | AbrahamLinksus/claude-craft (public) |
| Local folder | C:/Users/Jake/claude-craft/claude-craft (worktrees in C:/Users/Jake/claude-craft/claude-craft-wt/; start sessions in C:/Users/Jake/claude-craft) |
| Status | Active |
| Stage | 7 Build |
| Design | separate system design (why: large; daemon + client are separately running parts; external service = Claude Agent SDK) |
| Plugin | dev-team-setup 1.1.0 |
| Runners | on, but limited: the guard treats task-runners' Bash as git-pr (no pipes/redirects), so runners skipped test/review/sync on T-03; the Orchestrator ran those steps itself. Consider running steps directly. |
| Owner mode | builder |
| Size | large · signals: external service (Agent SDK), multi-process (daemon/client), public plugin API, concurrency |
| Milestone | M2 · Core scaffolding (3/9 tasks: T-01b, T-06s, T-01c) |
| Next step | T-06 (wire Shell into app.tsx, then test+review), T-07, then T-01d/T-04/T-08 |
| Started | 2026-11-25 14:13 +05:30 · Budget 0 (no cap) |
| Last updated | 2026-11-26 18:02 +05:30 |

Owner: Jake · GitHub owner: AbrahamLinksus · Approval mode: every-task · Cost mode: balanced · Visuals: installed

## Team
| Agent | Model | Why on this project |
|---|---|---|
| backend-coder | Sonnet | Daemon, core, grafts, git worker |
| frontend-coder | Sonnet | Desktop client, screens, TALK/LAB input |
| agent-engineer | Sonnet | Agent SDK adapter (AgentPort), interception layer |
| devops | Sonnet | CI, dependency-cruiser, perf budgets, installer |
| prompt-engineer | Sonnet | Race's optional Claude review-score prompt (M9) |
| tester | Sonnet | Every task |
| reviewer | Opus (Sonnet on low-risk, balanced) | Every task, read-only |
| debugger | Opus (Sonnet on low-risk, balanced) | Failures |
| docs | Haiku | README, architecture notes |

## Open work
- Tasks in progress live on `wip/*` branches (see `taskgit.sh list`); their step states are in each branch's TASK_PROGRESS.md.

## Open decisions (waiting for the owner)
- none

## How to run
(filled at stage 5)

## Known minors
| Task | Where | Fix | Size |
|---|---|---|---|
| T-06s | electron postinstall | pnpm doesn't run electron's install script, so a fresh clone has no electron dist/ — T-01d's start script (or allowBuilds electron) must handle it | ≈10 min |
| T-01c | protocol/src/wire.ts:1256 | seq .nonnegative() | ≈2 min |
| T-01c | protocol/src/address.ts:2 | platform: string | ≈2 min |
| T-01c | client/src/main/link.ts:217-229 | move needFull/destroy into resync() | ≈10 min |
| T-01b | docs/LLD.md §0.3 | rule workspace-dep-declared uses `unknown` restricted to @craft names, not npm-no-pkg/npm-unknown — architect wording at M2 sync | ≈3 min |
| T-01 | client/src/preload/index.ts:16-24 | architect records ipcRenderer + ready/pickFolder/log in LLD | ≈2 min |
| T-01 | daemon/src/server/server.ts:62-64 | stale daemon.sock on non-Windows | ≈10 min |
| T-01 | daemon/src/store/store.ts:110 | async save | ≈2 min |
| T-01 | daemon/src/store/settings-service.ts:11 | invalid-setting reply text (PROTOCOL_ERROR wording) — change request | ≈5 min |
| T-02 | spikes/sdk/s5-driver.mjs:79-82 | wait on `close` not `exit`; guard the PID match | ≈2 min |

## Context additions
| Role | Also read | Why (from gap report) |
|---|---|---|
| tester (client tasks) | the renderer component that shows LinkState.message | T-01c: nobody checked the version Notice appears on screen |
| reviewer | docs/LLD.md sections for every module whose stub/signature the task fixes (foundation-type tasks: §6–§13) | T-01 review couldn't check stub signatures without them |
| researcher | full docs/SPEC.md | Read only SPEC §6-11 on the first research step |

## Notes for the next session
- Owner's original spec is saved verbatim at docs/source/spec-v2.md.
- (resolved 2026-11-26: plan approved) Paused at stage 6: the planning card was shown (30 tasks, 16 rounds, parallel factor 1.88; warnings: 12 milestones kept by D-05/D-15; T-04/05/06/28 are intended shared-code tasks). On resume, re-send that card. All planning work is on branch wip/plan (worktree claude-craft-wt/plan), not yet on main.
- LLD frozen list still names vitest.workspace.ts; the env step made it root vitest.config.ts (architect to fix at the next as-built sync).
- T-02 follow-ups: approve `koffi` at the task that builds process/ (reaper tier B); clean-env re-run of the API-key precedence finding before changing LLD §6.3; LLD §6.2 auth mapping refinement (Not logged in → AUTH_MISSING); holds > 600 s unmeasured.
- Owner's weekly Claude limit was at 99% during T-02 (2026-11-26).
- Milestone 1 approved 2026-11-26; owner chose a fresh session. CR-1 merged (D-26). Also add a simple one-command start script early (no start/dev script exists yet; README says so).
- Taskgit gotchas on this machine: pass the repo path (C:/Users/Jake/claude-craft/claude-craft) to every taskgit command and run from C:/Users/Jake/claude-craft; set PYTHONUTF8=1 for capture.py mermaid and cost.py (Windows charmap errors). cost.py reports $0.00 here (not readable).
- Quality-check configs (.dependency-cruiser.cjs, eslint, check.sh) can only be changed by env-setup, not devops.