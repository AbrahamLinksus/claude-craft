# DECISIONS — claude-craft

## Tier 1 — decided by the owner
| ID | Date | Decision | Chosen | Means for you · if wrong | Alternatives | Task |
|---|---|---|---|---|---|---|
| D-01 | 2026-11-25 | Repo visibility | Public GitHub repo AbrahamLinksus/claude-craft | Anyone can read the code and anything pushed | Private; local only | — |
| D-02 | 2026-11-25 | Platforms | Windows first and tested; Mac/Linux should work, untested | Mac/Linux bugs may show up later | Windows only; all three tested | — |
| D-03 | 2026-11-25 | Claude sign-in | Subscription login with API-key fallback | If the terms forbid subscription login, switch to API key | API key only; subscription only | — |
| D-04 | 2026-11-25 | Session histories | Saved in the repo; per-repo push prompt; 'no' repos keep them in ~/.craft outside git | Pushed histories in a public repo are public | Never push; always push | — |
| D-05 | 2026-11-25 | v1 scope | All 12 milestones | Longer road to v1 | Milestones 1-7 as v1 | — |
| D-06 | 2026-11-25 | Undo | Merge/prune/pick ask first and stay undoable until pushed; undo after main moved adds a reverting commit | — | Undo everything; screen actions only | — |
| D-07 | 2026-11-25 | Second computer | No sync; settings are plain files copied by hand | Copying is manual | Sync folder; git repo; online account | — |
| D-08 | 2026-11-25 | Race judge | Tests + lint; optional Claude review score, off by default | Score uses limits when on | Tests/lint only; always score | — |
| D-09 | 2026-11-25 | Sample graft | In Craft's own repo, checked every build | — | Separate starter repo | — |
| D-10 | 2026-11-25 | Product name | Craft (repo stays claude-craft for now) | Repo rename still open | Claude Craft | — |
| D-11 | 2026-11-25 | Critic gaps G-1..G-23 | Owner answers recorded in SPEC.md tagged (owner, ... G-n) | — | see docs/scenarios.md | — |
| D-12 | 2026-11-25 | Windows connection | Named pipe | — | Localhost port + token | — |
| D-13 | 2026-11-25 | Graft capabilities | Add run commands, change git, prompt sessions, control sessions | — | Fold into existing | — |
| D-14 | 2026-11-25 | Worktree per session | From milestone 3 | — | Milestone 5 | — |
| D-15 | 2026-11-25 | HLD defaults | Electron lean (spike 4 decides); Node daemon; two-entry graft packages; keep 12 milestones | — | Tauri; Bun; one entry; regroup | — |
| D-16 | 2026-11-25 | Default sign-in | Subscription login default (owner confirmed twice after the terms warning); API key available | Anthropic's terms forbid third-party apps offering subscription login; other users' accounts at risk; changeable in one setting | API key default; ask on first start | — |
| D-17 | 2026-11-25 | Agent permissions | Edits inside the session worktree auto-approved (radar still checks); other tools ask | — | Ask for everything; approve everything | — |
| D-18 | 2026-11-25 | Interceptor graft crash | Fail closed: calls hold and ask the owner until answered or the graft restarts | Agents may wait on a prompt | Let through (architect's draft); deny | — |
| D-19 | 2026-11-25 | Graft isolation | In-process, capabilities checked not sandboxed (v1) | A malicious third-party graft could ignore its leaflet | Isolated worker per graft | — |
| D-20 | 2026-11-25 | Standard toolkit | TS 6.0.x, ESLint+typescript-eslint+Prettier, Node 24.22.3, pnpm, zod, React, Vite, vitest, Playwright, dependency-cruiser, gitleaks | — | Biome | — |
| D-21 | 2026-11-25 | LLD trade-offs #2-#13 | Approved as proposed (Electron 45.5 pending spike 4, SDK pinned 0.3.332, pipe token handshake, PreToolUse interception, process cleanup plan, Electron's Node, DOM grid, react-virtual, electron-builder) | — | see .results/plan/lld-architect.md | — |
| D-22 | 2026-11-25 | Install plan + 5 type/lint helper packages | Approved: @types/node, @types/react, @types/react-dom, @eslint/js, globals; Node 24.11 kept locally (CI 24.22.3); pnpm 12.23 via packageManager | ~1.5 GB in user folders, no admin | Edit; cancel | — |
| D-23 | 2026-11-26 | T-03 shell spike installs | Electron only (~250 MB in the project folder); Tauri not measured | The 'both shells measured' criterion is waived; Tauri stays the untested alternative | Install both (Rust + C++ tools); neither | T-03 |
| D-24 | 2026-11-26 | Desktop shell (spike 4) | Electron 45.5.0 locked | p95 17–18 ms vs 50 ms target; Tauri not measured (D-23) | Tauri | T-03 |
| D-25 | 2026-11-26 | Shared-format fixes before M2 | Fix now as change request CR-1: @craft/protocol workspace deps + codemod for relative imports; seq in snapshot.get reply (stale lastSeq after resync) | ~30 min; M2 builds on the corrected format | Leave as known minors | CR-1 |

## Tier 2 — decided by agents (overrule any time)
| ID | Date | Decision | Chosen | Agent | Task |
|---|---|---|---|---|---|
