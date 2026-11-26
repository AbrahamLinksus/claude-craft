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
| Runners | to be checked when the build starts |
| Owner mode | builder |
| Size | large · signals: external service (Agent SDK), multi-process (daemon/client), public plugin API, concurrency |
| Milestone | M1 · Skeleton and spikes (0/3 tasks) |
| Next step | Round 1: T-01, T-02, T-03 |
| Started | 2026-11-25 14:13 +05:30 · Budget 0 (no cap) |
| Last updated | 2026-11-26 07:41 +05:30 |

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

## Context additions
| Role | Also read | Why (from gap report) |
|---|---|---|
| researcher | full docs/SPEC.md | Read only SPEC §6-11 on the first research step |

## Notes for the next session
- Owner's original spec is saved verbatim at docs/source/spec-v2.md.
- (resolved 2026-11-26: plan approved) Paused at stage 6: the planning card was shown (30 tasks, 16 rounds, parallel factor 1.88; warnings: 12 milestones kept by D-05/D-15; T-04/05/06/28 are intended shared-code tasks). On resume, re-send that card. All planning work is on branch wip/plan (worktree claude-craft-wt/plan), not yet on main.
- LLD frozen list still names vitest.workspace.ts; the env step made it root vitest.config.ts (architect to fix at the next as-built sync).
