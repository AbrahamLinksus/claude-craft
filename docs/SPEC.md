# SPEC — Craft

> Written by the planner from the owner's answers, round by round. Approved before any design.
> Lines marked *(assumed)* were decided by the planner because the owner chose "decide for me" or the owner's spec left them open.
> Primary source: the owner's spec v2, verbatim at `docs/source/spec-v2.md` (referenced below as **v2 §<heading>**). Where this SPEC points to a v2 table, that table is part of this SPEC word for word.
> Name (owner, round 3): the product is **Craft**, described as "a workstation for Claude agents". The GitHub repo stays named `claude-craft` for now (see Open questions).

## 1. Goal
Craft, a workstation for Claude agents, is a keyboard-first, terminal-styled desktop app for running Claude agents. Today, running several Claude agents on one repo means juggling terminals, losing track of which agent is editing what, and colliding on the same files. Craft gives one developer one screen to see and control a fleet of Claude Agent SDK sessions: each session runs in its own git worktree and branch, every change is visible live (change feed, branch graph, file ownership), attempts can be forked and raced with the best one kept, an agent is stopped from silently editing a file another branch is changing, and usage limits and cost are always on screen. A background daemon owns the sessions so a UI crash never stops an agent. The core stays small (two modes, TALK and LAB, plus a shared command grammar); everything beyond one chat session is a **graft** built on a public, versioned graft API, so the first-party features prove that API by real use.

Pitch: see and control a fleet of Claude agents from one keyboard-first screen.

## 2. Users
| User | What they want | How often |
|---|---|---|
| Jake (owner), solo developer | Run 1–5 Claude agents in parallel on his own repos, watch what each changes, race attempts, avoid file collisions, stay inside his 5-hour and weekly limits | Daily, long working sessions |
| Other developers who find the public repo *(assumed)* | Install and use Craft the same way on their own machine; write their own grafts against the public API | Occasional; not a v1 design driver beyond "the graft API is documented and a sample graft exists" |
| Graft authors *(assumed: same people as above)* | Add verbs, objects, panels and widgets without touching core code | When building a graft |

Situation: one person at one computer, working in a local git repo, keyboard on the home row. Single user only (v2 "Not in v1").

## 3. User stories
| ID | As a… | I want to… | So that… | Acceptance (checkable) |
|---|---|---|---|---|
| US-01 | developer | open Craft, pick the repo to work in and see the Startup screen | I always know where the agent will work, even when I launch from the Start menu | Startup lists recent repos (most recent first) plus "open folder" (owner, gap round, G-1); j/k + enter or the repo's number picks one, "open folder" picks any git folder; the chosen repo's name shows in the statusline; then the empty buffer, one prompt and a hint line; typing a prompt + enter starts a session in TALK mode in that repo; a folder that is not a git repo is refused with "not a git repo: <path>" *(assumed)*; `:repo` returns to the repo list to switch, and sessions already running in the other repo keep running *(assumed)* |
| US-02 | developer | chat with one Claude session in TALK mode | I can work with an agent | Typed text goes to the active session; agent text and tool output stream into the centre pane; file tree with git colours shows on the right |
| US-03 | developer | switch between TALK and LAB with esc and i/enter | keys either talk to Claude or command Craft | esc shows the amber LAB chip; i or enter shows the blue TALK chip; no keystroke in LAB reaches the chat |
| US-04 | developer | type LAB sentences (count + verb + object) | I can command Craft fast | `3fs` creates 3 forks of the current session; `xs` stops it; `mb` merges the selected branch; `.` repeats the last sentence; `u` undoes the last undoable action |
| US-05 | developer | see a which-key popup after a partial sentence | I learn the grammar as I go | After `3f`, a popup lists every valid object (s, a, …) with its name and which graft added it |
| US-06 | developer | record and replay macros | I can repeat a command sequence | `qa … q` records macro a; `@a` replays it with the same effect |
| US-07 | developer | open panels with `:` commands | single keys stay free for grammar | `:wt :git :sessions :radar :race :usage :graft :team :rebase :prune :help` (plus `:repo` and `:settings` *(assumed)*) each open their panel/action; panel keys (j/k, q, enter) are listed in the panel footer |
| US-08 | developer | have modal prompts capture all keys | single-letter answers never leak into chat | While an approval or radar hold is open, typing `a` answers the prompt and nothing is sent to the session; when several prompts are open, only one shows at a time and the rest wait in a queue in arrival order, the prompt shows "1 of 3" and names the session first ("s2 wants to…"), and a key answers only the prompt on screen, after which the next one shows (owner, gap round 2, G-7) |
| US-09 | developer | have every session in its own worktree and branch, with its changes committed after every turn | agents never trample each other's working copy, and merge and fork never miss an edit | A new session creates `~/.craft/worktrees/<repo>/<session>` on a new branch; `:wt` lists it; session numbers keep counting up per repo and are never reused, so after `s1`–`s6` (merged, pruned or in the graveyard) the next session is `s7` on `craft/s7` (owner, gap round 2, G-18); two different repos with the same folder name (e.g. two `api` repos) get separate worktree folders (G-11); the session starts from the main checkout's last commit, and if the main checkout has uncommitted files it still starts and says "your 2 uncommitted files are not in s1" (owner, gap round 2, G-15); a repo with no commits yet is refused with "<repo> has no commits yet: make a first commit, then start a session" *(assumed)*; the main checkout shows no untracked files from it; at the end of every agent turn that changed files, Craft commits all of the session's changes to its branch automatically (owner, gap round, G-2), with a message naming the session and turn (e.g. `craft s2 · turn 4: Fix failing date parser test`) *(assumed)*; a turn that changed nothing adds no commit *(assumed)*; between turns the statusline shows M0 S0 for that session |
| US-10 | developer | run up to 5 sessions in parallel | I can run a fleet | 5 sessions stream at once; a 6th is refused with a message naming the cap setting; the cap is a setting; a command that would start more sessions than fit (e.g. `3fs` with 3 running and cap 5) asks "Only 2 fit: start 2? y/n": `y` starts 2, `n` starts none (owner, gap round 2, G-6); team tasks from `:team` do not count toward this cap (they have their own cap of 8, US-26; owner, gap round 2, G-13) |
| US-11 | developer | see sessions as tabs, Parallel panes or Tiling tiles | I can watch the whole fleet | Tabs on top on every session screen; `:sessions` opens Tiling by default (tiles + live branch-graph tile) and can switch to Parallel (one pane per session + worktree column) |
| US-12 | developer | see a git view of all branches | I know what's merged and what overlaps | `:git` shows trunk with unmerged branches above and merged below, a branch list and overlap warnings |
| US-13 | developer | merge, rebase, prune merged branches and review diffs from the keyboard | I can land work without leaving Craft | `mb` merges, `:rebase` rebases, `:prune` removes merged branches and their worktrees, `vb` shows the branch diff; `mb` or `:rebase` on a branch whose session is working pauses that session, merges/rebases, then resumes it; on a merge or rebase conflict it stops, lists the conflicted files, leaves the branch as it was and resumes the session (owner, gap round 2, G-14) |
| US-14 | developer | always see usage | I don't hit a limit by surprise | Top bar on every screen shows 5-hour and weekly bars with percent and reset time, tokens and cost; bars are green < 60%, yellow to 85%, red above (thresholds are a setting); bars show "unknown" when the SDK gives no limit data; when the last figure is more than 5 minutes old (offline, or no session running) or its reset time has passed, the bar turns grey and shows "out of date · last seen 14:02" until new data arrives *(assumed, G-21)* |
| US-15 | developer | see the statusline | I know where I am | Statusline shows mode chip, repo, session, model (orange Opus, blue Sonnet, teal Haiku), branch with M/S counts and ahead, session counts |
| US-16 | developer | have a session that hits a limit or is stopped saved as "cryo" and resumed later with its context | no work is lost to a limit or shutdown | A limited/stopped session shows as cryo with its reset time; `rs` after reset continues the same conversation in the same worktree; `rs` before the reset time tries to resume anyway, and if Claude still refuses, the session stays cryo and says "still limited · resumes after Mon 09:00" (owner, gap round 2, G-16); when the internet connection drops mid-turn, Craft retries on its own for a few minutes (5 by default, a setting *(assumed)*), and if it is still offline it pauses the session as "cryo · offline", resumable with `rs` (owner, gap round 2, G-9) |
| US-17 | developer | keep sessions running when the UI closes or crashes | a UI problem never kills an agent | Close or kill the client mid-stream; reopen it; the session is still running and the view shows everything that happened meanwhile. If the daemon itself stopped (crash, PC restart, Windows Update), every session comes back paused as cryo with its worktree and branch untouched, uncommitted edits included (owner, gap round, G-4); a session cut off mid-turn shows "cryo · interrupted mid-turn" and `rs` continues it *(assumed)*; worktrees under `~/.craft/worktrees` that Craft has no record of are listed ("2 unknown worktrees: d delete · k keep") and deleted only when the owner says so; Craft never deletes a worktree on its own |
| US-18 | developer | have every tool call pass an interception chain | grafts can allow, hold or deny actions | Each tool call is logged as allowed, held or denied with the graft that decided |
| US-19 | developer | be stopped when an agent edits a file another branch changed | no silent collisions | Radar opens a hold prompt naming the file and the other branch; `a` allows and flags, `w` waits for merge, `d` denies; the agent proceeds or gets a denial accordingly; after `w`, if the other branch is dropped instead of merged (moved to the graveyard, pruned, or its session stopped), the hold prompt reopens and asks again (owner, gap round 2, G-8) |
| US-20 | developer | see file ownership, edit heat and a change feed | I see who is changing what | `:radar` shows the hold prompt (if any), files by owning branch with edit heat, the live branch graph and a change feed |
| US-21 | developer | fork a session from any past turn | I can try a different path from a known point | Forking at turn N creates a new session whose conversation and repo state match turn N (the repo state is the commit Craft made at the end of turn N, US-09) |
| US-22 | developer | race N attempts at one task and pick a winner | I keep the best result | `:race` / `3fs` shows attempts side by side with diff, test result and lint result plus the fork graph; `pa` picks the winner; the losers move to the graveyard. Test and lint commands are guessed from the project files (e.g. `npm run test:unit` and `npm run lint` from `package.json`), shown on the race screen and editable per repo; an edited command is remembered for that repo (owner, gap round 2, G-10). Judging (owner, round 3) = tests + lint; a Claude review score is an option in settings, **off by default**: when off, the score column shows "off"; when on, each attempt gets a review score (0–10 with a one-line reason *(assumed)*), the race screen shows "review on: uses your limits", and the review's tokens count in the usage bars |
| US-23 | developer | manage grafts in the graft manager | I can tune what Craft does | `:graft` lists installed grafts with their dose (0–5), the shelf, and the leaflet of the selected graft; I can change a dose, install from the shelf and remove a graft |
| US-24 | developer | see a graft's leaflet before it gets new powers | I know what each graft may do | Installing, or updating a graft that changes its capabilities, shows the leaflet and needs confirmation; a graft using an undeclared capability is blocked |
| US-25 | developer | keep a focused session's cache warm | the next turn is cheaper and faster | With keep-warm at dose ≥ 1, the focused session is pinged on schedule; pings show in usage |
| US-26 | developer | run the dev-team-setup team as a graft | I can orchestrate a whole project from Craft | `:team` shows orchestrator chat, phase strip, swimlanes, parallelism strip (cap default 8), task queue with waiting tasks, and checkpoints; the team's cap of 8 is on top of the owner's own session cap, so with 2 own sessions running all 8 team tasks can run; tasks past 8 wait in the queue (owner, gap round 2, G-13) |
| US-27 | developer | cap cost or tokens per session (shelf graft) | a runaway agent can't burn my budget | With budget installed and a cap set, tool calls past the cap are denied and the session shows why |
| US-28 | developer | record and replay a session timeline (shelf graft) | I can review what happened | With recorder installed, `:replay` steps through a past session's events |
| US-29 | graft author | write a graft with a manifest and entry module using only the public API | I can extend Craft without core changes | A sample graft (fields per v2 §Graft API manifest table) lives in Craft's own repo (owner, round 3), loads, registers a verb and a panel, and works; every build loads it and checks it, and the build fails if it breaks or uses anything outside the public API |
| US-30 | developer | have broken or clashing grafts fail safely | one bad graft never takes Craft down | Two grafts claiming the same key fail at load naming both; a missing dependency fails with an install hint; bad settings fall back to defaults with a warning; a graft that throws shows an error in its own panel while the rest keeps running |
| US-31 | developer | sign in with my Claude subscription, and switch to an API key if I need to | I can keep working if subscription sign-in stops working in third-party apps | Settings show which sign-in is active (subscription or API key); switching to API key and entering a key makes the next session use it; the key is never shown in full on screen and never written to a tracked file; a missing or rejected sign-in shows how to fix it and starts no session |
| US-32 | developer | keep my settings, graft doses, saved prompts and usage history in plain files I can copy to another computer by hand | I can set up a second computer the same way without any sync service | Settings, doses, prompts and usage history are readable files in `~/.craft`; copying `config`, `prompts` and `usage` to another computer's `~/.craft` and starting Craft there shows the same settings, doses, prompts and history; the copy steps (F-10) say that the copied usage history replaces the one already on that computer (owner, gap round 2, G-19); per-repo answers (push, test/lint commands) follow a repo by its remote address, so they apply on the other computer even if the repo lives at a different path; repos with no remote are known by folder path (owner, gap round 2, G-11); the API key is kept in a separate file, so copying settings never copies the key *(assumed)*; a copied file that fails to load falls back to defaults with a warning naming the file (as US-30); nothing syncs automatically (owner, round 3) |
| US-33 | developer | be asked, per repo, whether that repo's session histories may be pushed | private prompts and replies never go public by accident | The first time a session starts in a repo, a modal asks "Push session histories for <repo>? y yes · n no (keep on this computer)"; the answer is remembered for that repo (recognised by its remote address, or by folder path if it has no remote: owner, gap round 2, G-11) and can be changed in settings *(assumed)*; with "yes", histories are saved in the repo (`.craft/sessions/`) and committed with git, and anything that looks like a key or password (e.g. `API_KEY=sk-…` printed by `type .env`) is blanked out before the history is saved (owner, gap round 2, G-12); a pushed history is saved in parts of 50 MB or less (`<id>.jsonl`, `<id>.2.jsonl`, …), so the git host accepts every push (owner, spec approval, G-20); with "no", histories are kept in Craft's own folder on this computer (`~/.craft/sessions/<repo>/`), never in the repo or in git (owner, gap round, G-3), so no push from any tool (Craft, VS Code, a terminal) can send them; changing the answer later applies to sessions started after the change, and histories already saved stay where they are *(assumed)* |
| US-34 | developer | confirm merges, prunes and race picks, and still undo them with `u` until pushed | a wrong key never costs me work | `mb`, `:prune` and `pa` each show a confirm prompt (y/n) naming what will change; the `:prune` confirm also names the untracked files in the worktrees it removes (e.g. `craft/s4: .env`), because `u` cannot bring those back (owner, gap round 2, G-17); single untracked files are listed one by one, while git-ignored build folders (e.g. `node_modules/`, `dist/`) collapse into one line with a file count (`node_modules/ (40 112 files, ignored)`), so files like `.env` stay visible *(assumed, G-22)*; `mb` on a branch whose session is mid-turn says so in the confirm: "turn 5 still running, not included · y merge 4 turns · w wait for turn end · n cancel"; `w` waits until the turn ends and its commit is made, then merges every turn (5 here) *(assumed)* (owner, spec approval, G-23); after confirming, `u` restores the state before (merge: if main has not moved since, main and the branch as before; if main has new commits since the merge (the owner's own, another merge), `u` adds a commit that takes the merge back out and keeps every later commit (owner, gap round, G-5), and the branch shows as unmerged again *(assumed)*; prune: branches and worktrees back; pick: winner unpicked, losers back from the graveyard); once the result is pushed, `u` shows "already pushed, can't undo" and changes nothing; the last 20 undoable actions are kept and survive a client restart *(assumed)* |

## 4. Main flows
### F-1 · Start and chat (US-01, 02, 03, 09, 15, 17, 31, 33)
1. Open Craft (from the Start menu or anywhere); the client connects to the daemon (starting it if not running) and shows Startup with the recent-repos list plus "open folder" (US-01).
2. Pick a repo (or open a folder); its name shows in the statusline.
3. Type a prompt + enter; the first time in this repo, the push-histories prompt (US-33) appears and is answered; daemon creates a session (worktree + branch), streams agent text and tool output; the file tree updates with git colours; at the end of each turn Craft commits the session's changes to its branch (US-09).
4. esc → LAB; i/enter → TALK. `:repo` goes back to the repo list.
- Errors: daemon unreachable → client shows "reconnecting" and retries; Claude login missing/invalid → clear message with how to sign in (subscription login, or switch to an API key in settings), no session created; subscription login refused by Claude for third-party apps → same message, suggesting the API-key fallback; client crash → daemon keeps going, client reopens to the latest state; daemon crash or PC restart → on next start every session is cryo with its worktree untouched and unknown worktrees are listed for the owner to delete or keep (US-17); a recent repo whose folder is gone → shown greyed as "missing" with an option to remove it from the list *(assumed)*; picked folder is not a git repo → "not a git repo: <path>", nothing starts *(assumed)*; main checkout has uncommitted files → the session starts from the last commit and says "your 2 uncommitted files are not in s1" (G-15); internet drops mid-turn → Craft retries on its own for a few minutes, then pauses the session as "cryo · offline" (G-9).

### F-2 · Command in LAB (US-04–08)
1. esc; type a sentence (`3fs`); after each partial key the which-key popup shows valid next keys.
2. A complete sentence runs; `.` repeats it; `u` undoes the last undoable action.
3. `qa … q` records, `@a` replays; `:cmd` opens a panel.
- Errors: invalid key in a sentence → sentence cancels with a one-line hint, nothing runs; modal prompt open → all keys go to it; several prompts open → one shows at a time with "1 of 3" and the session named first, the rest wait in a queue (G-7).

### F-3 · Parallel sessions (US-09–11)
1. Start or fork sessions until up to 5 run; `:sessions` opens Tiling (or Parallel).
- Errors: at the cap → refused with message; a command asking for more sessions than fit → "Only 2 fit: start 2? y/n" (G-6); uncommitted files in the main checkout do not block a session (it starts from the last commit and says which files are not in it, G-15); worktree creation fails (e.g. disk full) → session not started, error shown; after a crash or restart, worktrees Craft has no record of are listed for the owner to delete or keep, and worktrees of known sessions (cryo included) are never touched (US-17).

### F-4 · Git (US-12, 13, 34)
1. `:git` shows the graph; select a branch; `vb` reviews diff; `mb` merges; `:rebase`, `:prune`.
2. `mb` and `:prune` show a confirm prompt first; `y` runs, `n` cancels; `u` undoes the last merge or prune until it is pushed. Merges include everything the session did, because every finished turn is already committed (US-09).
3. `u` on a merge when main has moved since: Craft adds a commit that takes the merge back out, keeping later commits (US-34); when main has not moved, main and the branch go back exactly as before.
4. `mb` or `:rebase` on a branch whose session is working: Craft pauses the session, merges or rebases, then resumes it (G-14).
5. `:prune` confirm names untracked files in the removed worktrees (e.g. `.env`) that `u` cannot bring back (G-17); ignored build folders show as one line with a file count *(assumed, G-22)*.
6. `mb` on a branch whose session is mid-turn: the confirm says the running turn is not included and offers `w` wait for turn end (G-23).
- Errors: merge or rebase conflict → it stops, conflicted files listed, branch left as it was, a paused session resumes (owner, gap round 2, G-14); prune skips branches with unmerged work; `u` after push → "already pushed, can't undo", nothing changes.

### F-5 · Usage, halt and resume (US-14, 16, 17)
1. Top bar updates from SDK limit events.
2. Limit hit or `xs` → session saved as cryo with reset time; after reset `rs` resumes with context.
3. `rs` before the reset time tries to resume anyway; if Claude still refuses, the session stays cryo and says when the limit resets (G-16).
4. Connection lost mid-turn → Craft retries on its own for a few minutes; still offline → session paused as "cryo · offline", `rs` resumes it (G-9).
- Errors: no limit data → bars show "unknown"; data older than 5 minutes or past its reset time → bars grey with "out of date · last seen <time>" *(assumed, G-21)*; resume fails → session stays cryo with the error shown; daemon stopped by a crash or PC restart → every session comes back cryo, mid-turn ones marked "interrupted mid-turn", all worktrees untouched (US-17).

### F-6 · Interception and radar (US-18–20)
1. Agent requests a file edit; the chain runs (radar, budget, approvals).
2. If another branch changed that file, radar holds and shows the prompt; owner answers a / w / d. Several holds queue one at a time ("1 of 2", session named first, G-7).
3. After `w`, if the other branch is dropped instead of merged (graveyard, pruned, session stopped), the hold prompt reopens and asks again (G-8).
- Errors: hold left unanswered for minutes → the agent waits (spike 2 checks this is possible); if the SDK can't wait, the call is denied with a "held too long" reason *(assumed)*.

### F-7 · Fork and race (US-21, 22, 34)
1. Fork at a turn, or `3fs` / `:race` for N attempts at one task. If fewer than N fit under the session cap, Craft asks "Only 2 fit: start 2? y/n" (G-6).
2. Each attempt runs in its own branch; tests and lint fill in, using the repo's test and lint commands guessed from the project files, shown on the race screen and editable per repo (G-10); if the Claude review score is turned on in settings, each finished attempt is also reviewed and scored; `pa` asks to confirm, then picks; losers go to the graveyard; `u` un-picks until pushed.
- Errors: an attempt crashes → marked failed, others continue; no tests in project → test column shows "no tests"; review on but a limit is hit or the review fails → score shows "review failed" (or "limit reached") and the race still works on tests + lint *(assumed)*.

### F-8 · Graft management (US-23–25, 27–30)
1. `:graft`; select a graft; change its dose, read its leaflet, install from shelf or remove.
- Errors: as US-30.

### F-9 · Orchestrate (US-26)
1. `:team`; chat with the orchestrator; watch phases, lanes, queue and checkpoints; answer checkpoints. Team tasks run under their own cap of 8, on top of the owner's session cap; tasks past 8 wait in the queue (G-13).
- Errors: a team task fails → its lane shows the failure and the checkpoint asks what to do.

### F-10 · Set up a second computer by hand (US-32)
1. On computer A, copy `~/.craft/config`, `~/.craft/prompts` and `~/.craft/usage` (e.g. to a USB stick or a folder the owner already syncs).
2. On computer B, install Craft, put the files in `~/.craft` (`%USERPROFILE%\.craft` on Windows), start Craft, and enter the API key there if API-key sign-in is used. The copy steps say plainly: the copied `usage` history replaces the usage history already on computer B (owner, gap round 2, G-19). Per-repo answers apply to the same repo on B even at a different path, because repos are known by their remote address (folder path if no remote) (G-11).
3. The two computers are independent from then on; later changes stay on the computer where they were made.
- Errors: a copied file is damaged or from a newer Craft version → that file falls back to defaults with a warning naming it, the rest loads *(assumed)*.

## 5. Inputs and outputs (concrete examples)
| Flow | Example input | Expected output |
|---|---|---|
| F-1 | Settings → sign-in: switch to API key, paste `sk-ant-api03-…x7Qa` | Settings show "Sign-in: API key (…x7Qa)"; next session starts using it |
| F-1 | Prompt "Add a --verbose flag to cli.ts" in repo `~/code/notes-app` | Session `s1` on branch `craft/s1` in `~/.craft/worktrees/notes-app/s1`; streamed text; `src/cli.ts` red (modified) in the file tree; statusline mid-turn `TALK · notes-app · s1 · Sonnet · craft/s1 M1 S0 ↑0 · 1 session`; after the turn ends Craft commits it and the statusline shows `craft/s1 M0 S0 ↑1` |
| F-1 | First session in `~/code/notes-app` | Prompt "Push session histories for notes-app? y yes · n no (keep on this computer)"; `n` → histories saved in `~/.craft/sessions/notes-app/`; the repo has no `.craft/sessions` folder, so a `git push` from VS Code sends no session history |
| F-1 | Craft opened from the Start menu; recent repos `notes-app`, `craft-site`, `api` | Startup: "1 notes-app  C:\Users\Jake\code\notes-app · 2 craft-site  C:\Users\Jake\code\craft-site · 3 api  D:\work\api · o open folder…"; `1` → statusline `TALK · notes-app · …` |
| F-1 | `s2` finishes turn 4 after editing `src/db.ts` and `src/db.test.ts` | Commit `craft s2 · turn 4: Fix failing date parser test` on `craft/s2`; statusline `craft/s2 M0 S0 ↑4` |
| F-1 | PC restarted by Windows Update overnight with `s1`, `s2` cryo, `s3` mid-turn, `s4` idle with edits; plus an unknown folder `~/.craft/worktrees/notes-app/s9` | Next start: `s1`–`s4` all cryo, `s3` "interrupted mid-turn", `s4`'s edits still in its worktree; prompt "1 unknown worktree: notes-app/s9 · d delete · k keep" |
| F-2 | LAB: `3f` | Which-key popup: `s session (core) · a attempts (race)` |
| F-2 | LAB: `3fs` | 3 new sessions `s2 s3 s4`, each a fork of `s1` at its last turn, on branches `craft/s2..s4` |
| F-3 | 6th session start with cap 5 | "5 of 5 sessions running; raise the cap in settings or stop one (xs)" |
| F-3 | `3fs` on `s1` with `s1`–`s3` running, cap 5 | "Only 2 fit: start 2? y/n"; `y` → `s4`, `s5` start; `n` → nothing starts |
| F-3 | New session in `notes-app` with 2 uncommitted files in the main checkout; sessions `s1`–`s6` used before | Session `s7` on `craft/s7` from the last commit; message "your 2 uncommitted files are not in s7" |
| F-1 | Wi-Fi gone for 6 minutes while `s1`–`s3` are mid-turn | Each shows "retrying…" for about 5 minutes, then "cryo · offline"; `rs` once back online continues each |
| F-2 | Two radar holds and one approval open at once | Prompt "1 of 3 · s2 wants to edit src/db.ts …"; after `w`, "2 of 3 · s4 wants to edit src/routes.ts …" |
| F-4 | `:rebase` on `craft/s3` while `s3` is mid-turn; main also changed `src/parser.ts` | `s3` pauses; conflict → "rebase stopped: src/parser.ts conflicts; craft/s3 unchanged"; `s3` resumes |
| F-4 | `:prune` of `craft/s1, s2, s4, s6`; `s4`'s worktree has an untracked `.env` | Confirm "Prune 4 branches and worktrees? Untracked files lost: craft/s4: .env · y/n" |
| F-4 | `:prune` of `craft/s4` whose worktree has untracked `.env` and an ignored `node_modules/` | Confirm "Prune 1 branch and worktree? Untracked files lost: craft/s4: .env · node_modules/ (40 112 files, ignored) · y/n" *(assumed, G-22)* |
| F-4 | `mb` on `craft/s5` while `s5` is in turn 5 | Confirm "Merge craft/s5 into main? turn 5 still running, not included · y merge 4 turns · w wait for turn end · n cancel" (G-23) |
| F-5 | Laptop offline since 14:02; no new limit data | Both bars grey, "out of date · last seen 14:02" *(assumed, G-21)* |
| F-1 | "yes" repo; `s3`'s history reaches 50 MB | History continues in `.craft/sessions/s3.2.jsonl`; every part stays at or under 50 MB, so pushes are accepted (G-20) |
| F-4 | `mb` on `craft/s2` | `craft/s2` moves to the merged-below section; main ahead count +1 |
| F-4 | `mb` on `craft/s2`, `y`, then `u` | Confirm "Merge craft/s2 into main (3 commits)? y/n"; after `u`, `craft/s2` is back above trunk and main's ahead count returns to its old value |
| F-4 | `mb` on `craft/s2`, `y`; owner then commits "fix typo in README" on main; then `u` | Main gets a new commit "Undo merge of craft/s2"; "fix typo in README" stays; `craft/s2` shows above trunk again |
| F-4 | `u` after main was pushed | "already pushed, can't undo"; nothing changes |
| F-5 | SDK limit event: five_hour, utilization 0.72, resets 17:40 | 5-hour bar yellow, "72% · resets 17:40" |
| F-5 | Session `s3` hits the weekly limit | `s3` shows "cryo · resumes after Mon 09:00"; `rs` after that time resumes |
| F-5 | `rs` on `s3` on Saturday, before the Mon 09:00 reset | Craft tries; Claude refuses; `s3` stays cryo, "still limited · resumes after Mon 09:00" |
| F-6 | `w` on the s2 hold; `craft/s3` then loses a race and goes to the graveyard | Hold prompt reopens: "s2 wants to edit src/db.ts — craft/s3 was dropped, not merged. a allow+flag · w wait · d deny" |
| F-7 | Race in `notes-app` whose `package.json` has `test:unit` and `lint` scripts | Race screen shows "tests: npm run test:unit · lint: npm run lint (guessed · e edit)"; an edit is kept for notes-app |
| F-1 | "yes" repo; an agent runs `type .env` printing `API_KEY=sk-live-4f9…` | The saved history shows `API_KEY=[hidden]` |
| F-6 | `s2` edits `src/db.ts`, which `craft/s3` changed 4 min ago | Hold prompt: "s2 wants to edit src/db.ts — also changed on craft/s3. a allow+flag · w wait for merge · d deny" |
| F-7 | Race of 3 on "Fix failing date parser test", review off (default) | Attempt cards: diff +12/−3, tests 41/41, lint 0, review "off"; `pa` on attempt 2, `y` keeps `craft/s6`, moves s5 and s7 to graveyard |
| F-7 | Same race with review turned on in settings | Race screen shows "review on: uses your limits"; attempt 2 card adds "review 8/10 · fixes the parser, adds a test for leap years"; the 5-hour bar rises by the review's tokens |
| F-8 | Radar dose 3 → 5 | Radar now holds every cross-branch edit (dose 1 = log overlaps only) |
| F-8 | Two grafts both claim key `p` | Load fails: "Key p claimed by race and my-graft" |
| F-8 | Build of Craft with the sample graft `grafts/sample-hello` changed to import git directly | Build fails naming `sample-hello` and the rule it broke ("grafts use the public API only") |
| F-10 | Desktop has radar dose 5 and 12 saved prompts; owner copies `config`, `prompts`, `usage` to the laptop's `%USERPROFILE%\.craft` | Laptop's Craft shows radar dose 5, the same 12 prompts and the desktop's usage history (replacing the laptop's own, as the copy steps warn); the "no" push answer for `api` applies to the laptop's `C:\dev\api` (same remote), not to the unrelated `C:\oss\api`; sign-in on the laptop asks for its own API key (if API-key sign-in is used); changing a dose on the laptop does not change the desktop |

## 6. Data
Plain files, no database server. Paths per v2 §Data, storage, performance and stability:

| Path | Holds | Source | Rough volume |
|---|---|---|---|
| `~/.craft/config` | Settings, graft doses, profile, per-repo answers (push yes/no, test and lint commands), keyed by remote address or folder path (G-11) | Owner via graft manager/settings/race screen | KB |
| `~/.craft/prompts` | Saved prompts and temperaments | Owner | KB–MB |
| `~/.craft/usage` | Usage history | SDK limit/usage events | Small, grows daily *(assumed: kept indefinitely)* |
| `~/.craft/` credentials file, separate from `config` *(assumed)* | API key (when API-key sign-in is used) | Owner | Bytes |
| `~/.craft/worktrees/<repo>/<session>` | Session worktrees, outside the repo | git | One repo-sized copy per live session (up to 5 + race attempts) |
| `.craft/sessions/<id>.jsonl` (inside the repo) | Append-only event log per session, for repos where the push answer is "yes"; split into parts of at most 50 MB (`<id>.2.jsonl`, …) (G-20) | Daemon | KB–tens of MB per session |
| `~/.craft/sessions/<repo>/<id>.jsonl` (outside the repo) | Append-only event log per session, for repos where the push answer is "no" (owner, gap round, G-3); never in git | Daemon | KB–tens of MB per session |
| `~/.craft/repos` *(assumed: a file next to `config`)* | Recent-repos list for Startup (path, name, last opened) | Daemon | KB |
| Per-turn commits on each `craft/<session>` branch | The session's file changes at the end of every turn (owner, gap round, G-2); used by merge and by fork at turn N | Daemon via git | One commit per turn that changed files |

- Logs are written atomically; a crash loses at most the last event. Config, session files and graft task files are validated on load.
- Usage limits come from the SDK's rate-limit event (status, resetsAt, rateLimitType, utilization), read defensively.
- On Windows `~/.craft` means `%USERPROFILE%\.craft`.
- Session logs are committed to the repo with git (owner, round 1) only for repos where the owner answered "yes" to pushing (owner, round 2; US-33); for "no" repos they stay in `~/.craft/sessions/<repo>/`, outside git, so nothing can push them (owner, gap round, G-3).
- Commits: Craft commits each session's changes to its own branch at the end of every turn (owner, gap round, G-2); the main checkout is changed only by merge and undo.
- Crash recovery (owner, gap round, G-4): the daemon keeps a record of every session and its worktree; after a crash or restart all sessions return as cryo and no worktree is deleted without the owner's say-so.
- Per machine (owner, round 3): settings, doses, prompts and usage history stay on the computer they were made on. They are plain files the owner can copy to another computer by hand (US-32); Craft never syncs them.
- Repo identity (owner, gap round 2, G-11): a repo is known by its remote address, so its answers are the same on every computer; a repo with no remote is known by its folder path. Two different repos with the same folder name never share worktree folders or answers.
- Session numbering (owner, gap round 2, G-18): session numbers count up per repo and are never reused; the daemon keeps the next number per repo.
- Secrets (owner, gap round 2, G-12): before a history is saved for a "yes" repo, things that look like keys or passwords are blanked out (`[hidden]`).
- Undo history: the last 20 undoable actions (merge, prune, race pick) *(assumed)*, kept by the daemon.
- Retention: session logs kept as long as the repo keeps them; graveyard branches (race losers) kept until the owner removes them with `:prune` or from the race graveyard; nothing is deleted automatically *(assumed)*.

## 7. Screens (UI projects)
Ten screens per v2 §Screens. Desktop app only (no mobile layout).

| Screen | Purpose | Key elements | Wireframe |
|---|---|---|---|
| Startup | First view | Recent-repos list plus "open folder", then empty buffer, one prompt, hint line; unknown-worktrees prompt after a crash | docs/wireframes/startup.png |
| TALK (single session) | Chat with one agent | Chat + tool output centre, file tree with git colours right, session tabs top | docs/wireframes/talk.png |
| Parallel | Watch all sessions | One pane per session, worktree column | docs/wireframes/parallel.png |
| Tiling | Default fleet layout | Tiles per session, live branch-graph tile | docs/wireframes/tiling.png |
| LAB | Command Craft | Open panels, pending sentence, which-key popup, grammar hint row | docs/wireframes/lab.png |
| Git | Branch overview | Trunk with unmerged above / merged below, branch list, overlap warnings | docs/wireframes/git.png |
| Orchestrate | Run the dev team | Orchestrator chat, phase strip, swimlanes, parallelism strip, task queue, checkpoints | docs/wireframes/orchestrate.png |
| Race | Compare attempts | Attempts side by side with diff, tests, lint, review score ("off" by default; "review on: uses your limits" note when on); the repo's test and lint commands (guessed, editable); fork graph | docs/wireframes/race.png |
| Radar | Collision control | Overlap hold prompt ("1 of 2" when several wait), file ownership with edit heat, live branch graph, change feed | docs/wireframes/radar.png |
| Graft manager | Tune grafts | Installed grafts with dose, shelf, leaflet of selected graft | docs/wireframes/graft-manager.png |

Settings (sign-in, session cap, usage thresholds, race review on/off, offline retry time, per-repo push answers and test/lint commands) open as a panel via `:settings` *(assumed: a panel, not an eleventh screen)*.
On every screen: top bar (5-hour + weekly bars with percent and reset, tokens, cost), statusline (mode chip, repo, session, model, branch M/S/ahead, session counts), bottom input bar (TALK) or command line/hint row (LAB).
Look: terminal-styled, not a real terminal; warm charcoal surfaces, off-white text, clay `#d97757` accent; git colours green committed / yellow staged / red modified or untracked; model colours orange Opus / blue Sonnet / teal Haiku; mono grid with fixed cell size. The owner's "Claude Craft – Terminal UI canvas" mockups are the visual reference.

Command grammar: verbs/objects/keys exactly per v2 §Modes and command grammar (tables + rules 1–3).

## 8. Integrations
- **Claude Agent SDK (TypeScript)**: agent loop, tools, permissions, context, resume. Only one adapter file imports SDK types; it maps SDK messages to Craft events AgentText, ToolStarted, ToolFinished, SubagentStarted, TurnFinished, RateLimit. Also used for the optional race review score (US-22), which runs as a Claude call and counts toward the owner's limits.
- **Claude account / sign-in** (owner, round 1): the owner's Claude subscription login by default, with an Anthropic API key as a fallback the owner can switch to in settings (US-31). Risk kept from v2: the terms for subscription login inside third-party apps are unclear; if it is refused, the API key keeps Craft usable (API usage is billed per token, so cost shows in the top bar). The key lives only in a local, untracked file.
- **git CLI** on the local machine (worktrees, status, branches, merge, rebase).
- No other external services (no sync service: owner, round 3).

## 9. Non-functional
- **Scale / load:** 1 user, up to 5 parallel sessions (setting), race attempts within that cap *(assumed)* (asking "Only 2 fit: start 2? y/n" when they don't all fit, G-6), orchestrator parallelism cap 8 on top of the session cap, so up to 13 agents at once (owner, gap round 2, G-13).
- **Connection loss** (owner, gap round 2, G-9): a session whose connection drops mid-turn retries on its own for a few minutes, then pauses as cryo; no work or context is lost.
- **Latency:** input latency < 50 ms with 5 sessions streaming; UI updates batched to ~30/s; long transcripts virtualized; git status in a worker (porcelain v2, no optional locks); file watching debounced; CI fails a build that breaks a performance budget.
- **Stability:** error boundary around every graft and panel; event-loop lag watchdog; agent child processes cleaned up on exit; after a crash or restart every session returns as cryo and worktrees with no record are listed for the owner to delete, never deleted silently (replaces v2's "orphan worktrees are garbage-collected"; owner, gap round, G-4); replay harness re-runs recorded logs; 1-hour soak test with 5 sessions before each release; the sample graft is loaded and checked on every build (US-29).
- **Offline:** needs internet for Claude; everything else (git view, logs, graft manager) works offline *(assumed)*.
- **Security & privacy:** all data stays on the owner's computer (session histories go to a remote only for repos where the owner said yes, US-33; settings move only when the owner copies them, US-32); session histories of "no" repos are never inside the repo, so pushes from other tools cannot send them (G-3); in histories of "yes" repos, things that look like keys or passwords are blanked out before saving (G-12); grafts may only use capabilities they declared (shown as a leaflet); radar can read tool calls, git status and worktree paths but not network, transcripts or start sessions. Credentials never written to tracked files, and kept apart from the copyable settings.
- **Cost:** Claude usage is the only running cost; keep-warm pings count toward limits (low default dose, focused session only); the race review score is off by default because each reviewed race uses limits.
- **Platforms/devices** (owner, round 1): Windows 11 first and tested (every Done check and the soak test run on Windows). macOS and Linux should work but are not tested in v1. The client-to-daemon connection must work on Windows (v2's Unix socket needs a Windows equivalent; the design picks it). Desktop only.

## 10. Constraints
- **Stack (owner's choice, v2 §Tech stack):** TypeScript; Claude Agent SDK (TS); daemon as a Node or Bun process; local socket with JSON messages; desktop client Tauri or Electron with React (decided in milestone 1 by a spike); mono-grid terminal look with theme tokens; git CLI in a worker; zod validation; dependency-cruiser enforcing "grafts depend on ports, never SDK/git directly; grafts talk only via the bus" in CI; vitest + replay harness.
- **Architecture (v2 §Core architecture, §Concept):** small core (modes, grammar registry, session host, AgentPort, event log, event bus with bounded queues where approvals/tool results/turn-finished are never dropped, interception layer, graft host with permission checks) + grafts for everything else; daemon owns sessions, thin client renders from a snapshot plus event stream.
- **Graft API (v2 §Graft API):** manifest fields, leaflet, dose 0–5, load-time registry checks 1–4, API versioned and frozen per major version, first-party grafts use the same public API; the sample graft lives in Craft's repo and is part of every build (owner, round 3).
- **First-party grafts (v2 §First-party grafts):** worktrees, git, usage, keep-warm, radar, race installed; orchestrator, budget, recorder on the shelf; defaults per that table. The worktrees graft's "orphan cleanup" means listing unknown worktrees for the owner to delete or keep, never deleting on its own (owner, gap round, G-4).
- **Build order:** 12 milestones per v2 §Build order, with milestone-1 spikes 1–5 per v2 §Risks. Owner's rationale kept: registry and architecture checks in milestone 2; race after interception and event log.
- **Deadline:** none; build in milestone order (owner, round 2). Copyable settings files (US-32), per-repo push prompt (US-33) and confirm + undo (US-34) land in the milestones that build settings, sessions and git/race respectively *(assumed; the design places them)*.
- **Name:** product name "Craft" in all user-facing text (owner, round 3); repo name `claude-craft` unchanged for now.
- **Deployment target:** runs locally on the owner's computer; no hosting.
- **Budget:** no cap set (STATE.md).

## 11. Non-goals (explicitly out)
- Multi-user use (accounts, shared sessions, teams on one Craft).
- A graft marketplace (online discovery/installation of third-party grafts).
- Model providers other than Claude.
- A real-terminal (TUI) client: planned after v1 behind the same socket.
- Rebuilding the agent loop, tools, permissions or resume that the Agent SDK already provides.
- Syncing settings, prompts or usage history between computers, or any cloud storage (owner, round 3: per machine, copied by hand).
- Moving live sessions or worktrees between computers, or running sessions on a server.
- A Claude review score turned on by default, or picking a race winner automatically *(assumed: the owner always picks with `pa`)*.

## 12. Definition of done
v1 = all 12 milestones of v2 §Build order, including radar, race, graft manager, orchestrator and hardening (owner, round 1; overrides the planner's suggestion to cut scope). All checks on Windows 11.
- [ ] Open Craft, sign in with the subscription (or switch to an API key), start a session in TALK, see streamed chat, tool output and a git-coloured file tree; close the window mid-stream, reopen, and the session is still going.
- [ ] Run 5 sessions in parallel, each in its own worktree and branch, viewed in Tiling and Parallel layouts; merge one from the Git screen with `mb` (after a confirm) and undo it with `u`; usage bars show real 5-hour and weekly percent, reset times, tokens and cost, and a limited session goes cryo and resumes after reset.
- [ ] Two sessions editing the same file triggers the radar hold prompt, and a / w / d each behave as described.
- [ ] `3fs` races 3 attempts, shows diffs, test and lint results side by side (review "off"); turning the review on adds a score to each attempt; `pa` keeps the winner while the losers sit in the graveyard.
- [ ] The sample graft in Craft's repo adds a verb and a panel and is checked on every build; changing a graft's dose in `:graft` changes its behaviour; with the budget graft installed and a cap set, a session past the cap is stopped with the reason shown; copying `config`, `prompts` and `usage` to a second computer shows the same settings, prompts and history there.
- [ ] `:team` runs a small dev-team project with the orchestrator (phases, lanes, queue, checkpoints visible); and the 1-hour soak test with 5 sessions passes with typing staying under 50 ms.

## 13. Data safety
- Backup (owner, round 1): session histories (`.craft/sessions/*.jsonl`) are saved into the repo with git for repos answered "yes"; everything else stays on this PC only, with no backup.
- Consequence: session logs contain every prompt, agent reply and tool output. Pushing (owner, round 2): Craft asks per repo the first time a session starts there (US-33). Saying yes for a public repo makes that repo's session histories public; saying no keeps them in Craft's own folder on this PC (`~/.craft/sessions/<repo>/`), never in git (owner, gap round, G-3): nothing can push them, from Craft or any other tool, but a wipe of this PC loses them.
- Secrets in pushed histories (owner, gap round 2, G-12): before a "yes" repo's history is saved, anything that looks like a key or password is blanked out. Something that doesn't look like a secret (e.g. a plain customer name) is not caught, so "yes" still means the histories are as public as the repo.
- Owner's uncommitted work (owner, gap round 2, G-15): a session starts from the main checkout's last commit and never touches the main checkout's uncommitted files; Craft says which files are not in the session.
- Agent work (owner, gap round, G-2): Craft commits each session's changes to its branch at the end of every turn, so a finished turn is never lost and can be forked; only a turn in progress when something breaks has uncommitted edits, and those stay in its worktree.
- Crash or restart (owner, gap round, G-4): every session comes back paused (cryo) with its worktree untouched; worktrees Craft doesn't recognise are listed for the owner to delete or keep; Craft never deletes a worktree silently.
- Second device (owner, round 3; replaces the round-2 "follow me" answer): no sync. Settings, doses, prompts and usage history stay per machine as plain files the owner can copy to another computer by hand (US-32). After copying, the two computers are independent. Copying `usage` replaces the usage history already on the other computer, and the copy steps say so (owner, gap round 2, G-19). The API key is not in the copied files and is entered on each computer *(assumed)*.
- If this PC is wiped or Craft reinstalled, the owner loses: settings, graft doses, saved prompts and usage history (unless the owner had copied the files somewhere), the API key (must be re-entered), any session work in `~/.craft/worktrees` that was never merged or pushed, and session logs of repos never pushed (or set to "no").
- Undo (owner, round 2): merges, prunes and race picks ask for confirmation first, and `u` can still undo them until the result is pushed (US-34). If main has moved since a merge, `u` adds a commit that takes the merge back out and keeps the later commits (owner, gap round, G-5). After a push they cannot be undone from Craft. Undoing a prune brings branches and worktrees back but not files git never tracked (e.g. `.env`); the prune confirm names those files first (owner, gap round 2, G-17). Merging or rebasing a working session's branch pauses it and, on a conflict, leaves the branch as it was (G-14). Everything else is not undoable *(assumed)*.
- Answered by the owner, never assumed. "No backup" is fine when the owner chose it knowing the consequence.

## Open questions
- Repo name: the GitHub repo is still `claude-craft` while the product is "Craft". Renaming the repo is a separate owner decision, outside this spec; it changes nothing in the build.
