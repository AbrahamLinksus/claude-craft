# Scenarios — Craft (product critic)

> Realistic usage walked against `docs/SPEC.md`. Each scenario is `handled` (with the US/F id), `resolved` (a gap the owner answered, now in the spec) or `GAP` (still open, see `G-n` in the critic's report).
> Platform: Windows 11 first; `~/.craft` = `C:\Users\Jake\.craft`.
> Re-check after gap rounds 1 and 2: G-1…G-19 all answered by the owner and verified in SPEC.md. Two answers left part of their scenario open (G-9, G-12) and the re-check found two new gaps; those are G-20…G-23 below.

## S-01 · Monday morning, launched from the Start menu
Jake clicks Craft in the Windows Start menu (no working folder). He has three repos: `C:\Users\Jake\code\notes-app`, `C:\Users\Jake\code\craft-site`, `D:\work\api`. He types "Add a --verbose flag to cli.ts" and presses enter.
- **resolved (G-1, high).** Owner: Startup lists recent repos (most recent first) plus "open folder"; pick by j/k+enter or number; repo name in the statusline; `:repo` switches, other repo's sessions keep running (US-01, F-1, §5 F-1 Startup row).

## S-02 · Racing with a fleet already running
`s1` (notes-app, Sonnet), `s2` and `s3` are streaming. Cap is 5. Jake focuses `s1` and types `3fs` to race the date-parser fix. The repo's tests are `npm run test:unit` (takes 4 min) and lint is `npm run lint`.
- **resolved (G-6, medium).** Owner: "Only 2 fit: start 2? y/n"; `y` starts 2, `n` none (US-10, F-3, F-7, §5 F-3 row).
- **resolved (G-10, medium).** Owner: commands guessed from project files, shown on the race screen, editable and remembered per repo (US-22, F-7, §5 F-7 row).

## S-03 · Merge, hand fix, undo
Jake merges `craft/s2` (`mb`, `y`). On the main checkout he then commits a one-line hotfix himself in VS Code (`fix typo in README`), not pushed. Then he realises s2 was wrong and presses `u`.
- **resolved (G-5, high).** Owner: `u` adds a commit that takes the merge back out and keeps later commits; if main hasn't moved, exact restore (US-34, F-4, §5 F-4 rows, §13).
- Before the merge, `s2` edited `src/db.ts` in its last turn (statusline `M1`). **resolved (G-2, high).** Owner: Craft commits the session's changes at the end of every turn that changed files (US-09, US-21, §6, §13).

## S-04 · Two holds at once
`s2` wants to edit `src/db.ts` (changed on `craft/s3`) and, one second later, `s4` wants to edit `src/routes.ts` (changed on `craft/s5`); a budget-graft denial message also arrives. Jake presses `w` for the first hold. `craft/s3` is later a race loser and goes to the graveyard.
- **resolved (G-7, medium).** Owner: one prompt at a time, rest queued in arrival order, "1 of 3", session named first; a key answers only the prompt on screen (US-08, F-2, F-6, §5 F-2 row).
- **resolved (G-8, medium).** Owner: if the waited-for branch is dropped (graveyard, pruned, session stopped), the hold prompt reopens (US-19, F-6, §5 F-6 row).

## S-05 · Windows Update reboots the PC overnight
At 23:10 Jake leaves 5 sessions: `s1` and `s2` are cryo (5-hour limit, resets 01:40), `s3` is mid-turn, `s4`, `s5` idle with uncommitted edits. Windows Update restarts the PC at 03:00. Next morning he opens Craft.
- **resolved (G-4, high).** Owner: every session returns cryo with its worktree untouched (uncommitted edits included); `s3` "interrupted mid-turn", `rs` continues it (assumed); unknown worktrees listed "d delete · k keep", never deleted on its own (US-17, F-1, F-3, F-5, §5 F-1 row, §13).

## S-06 · Private client repo "no", public repo "yes"
First session in `D:\work\api` (a client's private code): Jake presses `n`, later runs `git push` from VS Code. In `craft-site` (public, answered `y`) one agent ran `type .env`, and a 9-hour session running `npm test` in watch mode for every turn has grown its history to 140 MB.
- **resolved (G-3, high).** Owner: "no" histories live in `~/.craft/sessions/api/`, never in the repo or git, so no push from any tool sends them (US-33, §6, §13).
- **resolved (G-12, medium), secrets part.** Owner: things that look like keys or passwords are blanked to `[hidden]` before a "yes" history is saved (US-33, §6, §9, §13, §5 row).
- **GAP (G-20, medium), size part, still open.** The 140 MB history is committed into `craft-site`. Common git hosts warn at 50 MB and reject a file over 100 MB, so Jake's next `git push` of craft-site fails, and because the file is already in history, deleting it doesn't fix the push. §6 says "KB–tens of MB per session" with no rule for when a history gets too big.

## S-07 · Weekly limit on Friday
`s3` hits the weekly limit Friday 18:20: "cryo · resumes after Mon 09:00". Jake presses `rs` on Saturday by mistake, then again Monday 09:05.
- **handled (US-16, F-5)** for Monday: same conversation, same worktree.
- **resolved (G-16, low).** Owner: `rs` early tries anyway; if refused, stays cryo with "still limited · resumes after Mon 09:00" (US-16, F-5, §5 F-5 row).

## S-08 · Wi-Fi drops on the train
On the laptop, 3 sessions are mid-turn when the train enters a tunnel; the connection is gone for 6 minutes. The top bar showed "5-hour 72% · resets 17:40" when the tunnel started; it is now 17:55.
- **resolved (G-9, medium), session part.** Owner: retries on its own for about 5 minutes (a setting, assumed), then "cryo · offline"; `rs` once back online continues each (US-16, F-1, F-5, §9, §5 row).
- **GAP (G-21, low), usage part, still open.** The bars update only from SDK limit events (F-5 step 1). Offline, or with no session running, the top bar keeps showing "72% · resets 17:40" after 17:40 has passed, with nothing saying the figure is old. US-14 covers "no limit data" ("unknown"), not old data.

## S-09 · Laptop with copied settings, two repos called "api"
Jake copies `config`, `prompts`, `usage` to the laptop (F-10). The laptop already had 2 weeks of its own usage history. On the laptop the repo lives at `C:\dev\api`, not `D:\work\api`, and there is a second, unrelated public repo `C:\oss\api`.
- **handled (US-32, F-10)** for settings, doses, prompts and history.
- **resolved (G-11, medium).** Owner: repos are known by remote address (folder path if no remote); the copied "no" follows `api` to `C:\dev\api`, not `C:\oss\api`; same-named repos get separate worktree folders (US-09, US-32, US-33, F-10, §6, §5 F-10 row).
- **resolved (G-19, low).** Owner: the copy steps say the copied usage history replaces the laptop's own (US-32, F-10, §13).

## S-10 · Running the dev team
Jake opens `:team` on `craft-site`; the plan has 8 independent tasks; parallelism cap is 8. 2 of his own sessions are already running (session cap 5).
- **resolved (G-13, medium).** Owner: team tasks have their own cap of 8 on top of the session cap; all 8 run; tasks past 8 wait in the queue (US-10, US-26, F-9, §9).

## S-11 · Rebase while the agent is still working
`s3` is mid-turn editing `src/parser.ts`; Jake runs `:rebase` on `craft/s3` onto main, which also changed `src/parser.ts`.
- **resolved (G-14, medium).** Owner: Craft pauses the session, rebases, resumes it; on a conflict it stops, lists the files, leaves the branch as it was and resumes (US-13, F-4, §5 F-4 row, §13).

## S-12 · Brand-new repo and a dirty main checkout
Jake runs `git init` in `C:\Users\Jake\code\scratch` (no commits yet) and starts a session. In `notes-app` he has 2 uncommitted files in the main checkout when he starts a session.
- **resolved (G-15, medium).** Owner: the session starts from the last commit and says "your 2 uncommitted files are not in s7" (US-09, F-1, F-3, §5 F-3 row, §13).
- **handled (US-09, assumed)** for the empty repo: refused with "scratch has no commits yet: make a first commit, then start a session" (planner's assumption, not the owner's answer).

## S-13 · Prune, then undo
`:prune` lists 4 merged branches (`craft/s1, s2, s4, s6`); Jake confirms, then presses `u`. `s4`'s worktree had an untracked `.env` and a 600 MB `node_modules` (about 40 000 files). The next day he starts a new session.
- **handled (US-34, F-4)** for branches and worktrees coming back.
- **resolved (G-17, low).** Owner: the prune confirm names untracked files that `u` cannot bring back (US-34, F-4, §5 F-4 row, §13).
- **GAP (G-22, low), new.** Read literally, the confirm names every untracked file, so `node_modules` puts ~40 000 lines in a y/n prompt and buries `.env`. The spec doesn't say how a big untracked folder is shown.
- **resolved (G-18, low).** Owner: session numbers count up per repo and are never reused, so the new session is `s7` (US-09, §6, §5 F-3 row).

## S-14 · Subscription sign-in refused
Claude starts refusing subscription logins from third-party apps. Jake's next prompt fails; he opens `:settings`, switches to API key, pastes `sk-ant-api03-…x7Qa`.
- **handled (US-31, F-1, §5 F-1 row).** Clear message, no session, key shown as `…x7Qa`, kept out of copied files (US-32). Usage bars show "unknown" if the API key has no 5-hour data (US-14).

## S-15 · A graft throws
Jake's own graft `my-graft` throws on every event after he edits it; it also claims key `p`, already used by race.
- **handled (US-30, F-8, §5 F-8 row).** Load fails naming both grafts; a throwing graft shows its error in its own panel; the rest keeps running.

## S-16 · Merging a session that is mid-turn (new)
`s2` has finished turns 1–4 (committed) and is halfway through turn 5, having just rewritten `src/db.ts`. Jake sees "4 commits ahead" in `:git`, presses `mb`, `y`.
- **GAP (G-23, medium), new.** G-14's answer pauses the session, merges and resumes, but the merge contains only finished turns (US-09 commits at turn end). The confirm "Merge craft/s2 into main (4 commits)? y/n" doesn't say turn 5 is left out, so Jake believes the db rewrite is on main when it isn't; turn 5 then lands on `craft/s2` after the merge, and the branch shows as unmerged again with no explanation.
