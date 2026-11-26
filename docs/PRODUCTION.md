# PRODUCTION — Craft (repo `claude-craft`)

> The production gate. Project type: **local desktop app** (Electron client + background daemon on the
> owner's Windows 11 PC; no hosting, no accounts, no server reached over the internet). Kept: **All
> projects** and **Local app**. Removed: Web app (no web server or logins: Craft runs locally over a
> private named pipe), API (no network API: the pipe is per-user and local only), AI/ML service (Craft
> calls Claude through the Agent SDK but is not a model service; the optional race review is covered
> by T-23's criteria: off by default, failure falls back to tests + lint, prompt and model pinned).
> At handover every applicable item must be **Built + tested** (the proof below passed) or **Waived
> by the owner** (consequence stated, logged in DECISIONS.md). Handover can't be approved while any
> item is open.

Status values: `Open` · `Built + tested (<test or capture>)` · `Waived by the owner (D-xx: <consequence>)` · `N/A (<reason>)`

## All projects

| ID | Item | Proven by | Task | Status |
|---|---|---|---|---|
| G-01 | Errors reach the user in plain words; no stack traces or raw codes | a test that triggers each error path the spec names and checks the message | T-01 (error templates), T-04, T-05, T-06, T-07, T-09, T-10, T-14, T-16, T-18, T-19, T-23 | Open |
| G-02 | Saved data survives a restart of the app | a test that saves, restarts (or reopens the store) and reads it back | T-01 (store), T-04 (undo journal), T-08 (torn log tail), T-10 (settings), T-17 (usage history), T-24 (doses) | Open |
| G-03 | The SPEC §13 data-safety choice is built (backup/export, undo), or "no backup" is stated in the README | a test of the export/backup/undo path, or the README line | T-13 (never deletes worktrees silently), T-14 (merge undo), T-15 (prune undo), T-22 (pick undo), T-30 (README backup line) | Open |
| G-04 | No secrets in the repo; every key the app reads is listed in `.env.example` | the `check.sh` secret scan + the reviewer's check of config reads | T-01 (`.env.example`), T-10 (API key only in `credentials.json`) | Open |
| G-05 | Every user input is validated (empty, too long, wrong type) | one test per input the spec names | T-01 (wire messages, > 1 MB line), T-04 (prompt answers), T-10 (folder, API key), T-12 (LAB sentence keys) | Open |
| G-06 | A fresh clone installs and runs with the README's commands | the handover tester's fresh-clone run | T-30 | Open |

## Local app (desktop, CLI or single-device mobile)

| ID | Item | Proven by | Task | Status |
|---|---|---|---|---|
| G-L1 | Works with no network connection | a test run with the network disabled (or no network calls in the code, per the reviewer) | T-18 (sessions retry then "cryo · offline"; git view, logs and graft manager keep working; Claude itself needs the internet, SPEC §9) | Open |
| G-L2 | An update keeps the user's existing data (schema changes migrate) | a migration test on data saved by the previous version | T-01 (store migrations + newer-schema fallback) | Open |
| G-L3 | Starts with one documented command or a packaged build | the handover tester's run of that command | T-29 (installer), T-30 (README command) | Open |
