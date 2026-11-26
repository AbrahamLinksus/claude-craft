# Agent SDK spikes 1, 2, 3, 5 and sign-in (T-02)

Run on Windows 11, Node 24.11, `@anthropic-ai/claude-agent-sdk` 0.3.332 (bundled `claude.exe` 2.1.332), model `haiku`,
2026-11-26. Scripts: `spikes/sdk/*.mjs` (set `SPIKE_TMP` to a scratch dir first). Recorded output: `spikes/sdk/fixtures/`
(credentials and the user name redacted by `save()` in `common.mjs`; the user name becomes `<user>` in every path style).
**Env caveat:** all fixtures were recorded from inside a Claude desktop agent session (`init.startup_timing.entrypoint` = `claude-desktop`),
and the scripts passed that session's `CLAUDECODE`/`CLAUDE_CODE_*` vars down to the SDK. `common.mjs` now strips those vars for future runs; the recorded runs did not.

| Spike | Result | Design branch chosen (LLD 0.7) |
|---|---|---|
| 1 Fork + resume in another cwd | PASS | Neither fallback: no `sessionStore` adapter, no transcript re-feed. Keep 7.4 as written. |
| 2 Hold hook / `canUseTool` 10 min | PASS (both) | No hidden timeout found up to 600 s; no `defer`/parked fallback needed for holds of this length. |
| 3 `rate_limit_event` | PARTIAL: claude-login captured; api-key not captured (no key on this PC) | Both windows present under claude-login. API-key shape unverified; keep the "absent under API key, bars show tokens/cost only" branch. |
| 5 Reaper tier | Tier A FAILS, tier B PASSES | **Tier B** (job object, kill-on-close, held by the daemon). Needs the koffi package (owner decision, see below). |
| Sign-in | PASS | `claude-login` works with the bundled, unmodified binary. Error shapes recorded below. |

## Spike 1: fork at turn N, resume in a different cwd (PASS)
`s1-fork.mjs`: two turns in cwd A (remember PINEAPPLE; remember ZEBRA). `forkSession(id, {dir: A, upToMessageId: <turn 1 last assistant uuid>})`
gave a new session id. `query({resume: forkId})` with `cwd` = a different, previously unused dir B answered **PINEAPPLE** only
(ZEBRA from turn 2 absent). So the fork is cut at turn N and the lookup works across cwds; no `sessionStore` needed.
Notes for T-06/T-0x:
- The `uuid` on the streamed `assistant` message equals the `uuid` listed by `getSessionMessages`, so `lastMessageId` = last assistant `uuid` of the turn works.
- Pass `dir` (the original session's cwd) to `forkSession`; the resumed session keeps the fork's id (`resume: forkId` -> `session_id` = forkId).
- Not exercised: a real git worktree at turn N's sha (only plain directories); that is the workspace layer's job (7.4), not the SDK's.
- Fixture: `fixtures/spike1-fork.json`.

## Spike 2: hold 10 minutes (PASS)
`s2-hold.mjs hook 600` and `s2-hold.mjs can 600`, run concurrently. Hook: `PreToolUse` with `timeout: 86_400` (as LLD 6.2), tool pre-approved so
only the hook holds; returned `{}` after 600 s. `canUseTool`: Bash `touch ... && echo` (needs approval); returned `allow` after 600 s.
Both: tool ran (`SPIKE2_OK` in the tool result), `result` = success, no error, no warning. Timestamps in `fixtures/spike2-hook.json`, `spike2-can.json`
(release at 601.7 s, tool result 0.2 s later, turn end at ~606 s).
Caveats: the hook had the explicit `timeout: 86_400`; the SDK's default hook timeout without it was not measured, so keep that setting. Holds longer than
10 minutes were not measured (the LLD's "no time limit" is only shown to 600 s). A read-only `echo` is auto-allowed and never reaches `canUseTool`
(needs a command that is not on the read-only list to test it).

## Spike 3: `rate_limit_event`
Captured under **claude-login** (`fixtures/rate-limit-claude-login.json`, whole turn in `signin-claude-login-messages.json`). One event per turn, before the result:
```
rate_limit_info: { status:'allowed_warning', resetsAt:<unix s>, rateLimitType:'seven_day', utilization:0.99,
  surpassedThreshold:0.75, overageStatus:'rejected', overageDisabledReason:'org_level_disabled',
  isUsingOverage:false, overageEnabled:false,
  unifiedWindows:{ five_hour:{utilization:0, resetsAt:<unix s>, status:'allowed'},
                   seven_day:{utilization:0.99, resetsAt:<unix s>, status:'allowed_warning', surpassedThreshold:0.75} } }
```
- Both windows present under claude-login; matches LLD 6.2's read `unifiedWindows.five_hour/seven_day`.
- Units: `utilization` is a **fraction 0..1** (0.99 = 99 %), `resetsAt` is **Unix seconds**.
- Optional/missing: `surpassedThreshold` is only on the window that crossed it (absent on `five_hour`); `status` is per window and top level; `overage*` fields appear only with overage info; the SDK type (`SDKRateLimitInfo`) makes everything except `status` optional, and `unifiedWindows` is **not in the SDK's type** (read structurally).
  The top level mirrors the most-used window (`rateLimitType` + `utilization` + `resetsAt`), the fallback in 6.2.
- Only one sample (a "warning" state). `rejected` state not observed.
- **Partial:** no API key is available on this PC (`ANTHROPIC_API_KEY` unset), so the api-key capture was not done. The SDK type comment says the event is "for claude.ai subscription users", so absence under an API key is expected but unconfirmed. To finish: `ANTHROPIC_API_KEY=... node spikes/sdk/s3-signin.mjs api-key` (writes `fixtures/rate-limit-api-key.json`; the contract test must accept zero events).
- Owner heads-up: at capture time the weekly window was at 99 %, so keep further live runs minimal.

## Spike 5: killing the daemon leaves no processes? (tier B chosen)
Harness: `s5-daemon.mjs` (fake daemon: 5 real SDK sessions, each running `sleep 280` through the Bash tool), `s5-driver.mjs` (snapshots the daemon's
descendants, kills only the daemon, 5 s later lists survivors by pid + creation time; a process counts as a descendant only if it was created after its parent, because Windows keeps stale
parent ids and reuses pids; cleanup kills only those verified pids, without `/T`). Per run: 5 `claude.exe`, 10 `bash.exe`, 10 `conhost.exe` descendants.

| Tier | Kill | Survivors | Evidence |
|---|---|---|---|
| A (libuv job, nothing added) | `Stop-Process -Force` (TerminateProcess) | **15** (10 bash, 5 conhost; the 5 claude.exe died) | `fixtures/spike5-default-stop-process.json` |
| A, model-free stand-in (5 node children each starting bash+sleep) | `taskkill /F` | **10** (5 sleep, 5 conhost) | `fixtures/spike5-fake-taskkill-f.json` |
| B emulated (kill-on-close job held only by the daemon) | `Stop-Process -Force` | **0** | `fixtures/spike5-default-stop-process-jobhost.json` |
| B emulated | `taskkill /F` | **0** | `fixtures/spike5-default-taskkill-f-jobhost.json` |
| B emulated, stand-in | `taskkill /F` | **0** | `fixtures/spike5-fake-taskkill-f-jobhost.json` |

Why A fails: libuv's job lets the daemon's direct child (`claude.exe`) die with the daemon, but that job has silent-breakaway, so what `claude.exe` starts (bash, then the tool) is outside it and keeps running.
Tier B emulation: `jobtools/jobhost.cs` (build: `csc -out:jobhost.exe jobhost.cs`) creates the job (`KILL_ON_JOB_CLOSE`, no breakaway flags), starts node suspended inside it, duplicates the only job handle **into the node process** and exits. This is the same end state as the daemon calling `CreateJobObject` + `AssignProcessToJobObject(GetCurrentProcess())` itself (LLD 6.4 tier B): the kernel closes the handle when the daemon dies, however it dies, and every descendant is killed (all 25 gone, including grandchildren).
**Decision: tier B.** Needs: (1) `koffi` (LLD 0.5 lists it for this case; installing a package is an owner decision for the task that builds `process/`), (2) a check that koffi loads in the shipped daemon runtime (not yet tested; if it fails, tier C `tools/jobwrap`). Tier C was not built, since B passes in the kernel-level test; if koffi is rejected, `jobhost.cs` shows the same job logic in C# to start from.
Caveats: Task Manager's GUI was not driven. "End task"/"End process" both end in `TerminateProcess`, which is what `Stop-Process -Force` and `taskkill /F` call; so the two commands stand in for it. The A run with `taskkill /F` against real claude.exe was not repeated (same API as the Stop-Process run). `sweepOrphans()` is still needed for crashes that skip the job (e.g. a daemon started before B was initialised).

## Sign-in (PASS)
- `claude-login`: env = parent env minus `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` (and, from now on, minus `CLAUDECODE`/`CLAUDE_CODE_*`; see the env caveat at the top), no `pathToClaudeCodeExecutable`. A turn ran to `result: success` (`s3-signin.mjs claude-login`); `init.apiKeySource` = `none`, `claude_code_version` 2.1.332.
- Binary unmodified: the bundled `claude.exe` sha256 `e6652f91...fd320` equals the checksum in the SDK's `manifest.json` (win32-x64).
- Credentials were never read, printed or saved by the scripts.

Error shapes (`signin-errors.mjs`; both reproduced with `CLAUDE_CONFIG_DIR` pointing at an empty dir so the owner's login was untouched):

| Case | Stream | Thrown by the iterator |
|---|---|---|
| Not signed in (no login) | `system init`, then `assistant` with `error:'authentication_failed'`, text `Not logged in · Please run /login`, `model:'<synthetic>'`, zero usage; then `result` `subtype:'success'`, `is_error:true`, `terminal_reason:'api_error'`, `result:'Not logged in · Please run /login'` | `Error: Claude Code returned an error result: Not logged in · Please run /login` |
| Refused (bogus API key, no login) | same shape, text `Invalid API key · Fix external API key` | `Error: Claude Code returned an error result: Invalid API key · Fix external API key` |
| Subscription refused by Anthropic (terms) | **not observable here** (would need a refusal from the service) | unknown |

Mapping (for `classify.ts`, T-06): `error:'authentication_failed'` (or the thrown text above) -> auth failure. Text starts `Not logged in` -> `AUTH_MISSING` (claude-login chosen but not signed in; hint "run Claude's own sign-in"). Anything else with `authentication_failed`, e.g. `Invalid API key`, and any unrecognised auth failure -> `AUTH_REJECTED` (LLD 0.7 fallback incl. the API-key hint). Note LLD 6.2 sends every auth failure to `AUTH_REJECTED`; splitting off "Not logged in" as `AUTH_MISSING` is a small refinement that the T-06 author can accept or drop.
**UNCONFIRMED finding (6.3 `api-key`), observed under the `claude-desktop` entrypoint env only:** with a valid login present on the PC and a bogus `ANTHROPIC_API_KEY` in env, the session did **not** fail; `init.apiKeySource` was `ANTHROPIC_API_KEY`, yet it ran on the login (`fixtures/auth-refused-key.json`). That run inherited the desktop agent's `CLAUDECODE`/`CLAUDE_CODE_*` vars, which may change which credential wins, so a stand-alone daemon may behave differently. The not-signed-in run (empty config dir) rules out an inherited OAuth-token var, not an entrypoint effect. **Do not change LLD 6.3 on this yet.** First do a clean-env re-run (`signin-errors.mjs refused-key` and `s3-signin.mjs claude-login`, with the stripping now in `common.mjs`, or from a plain shell). If it still runs on the login, the candidate fix is a Craft-owned `CLAUDE_CONFIG_DIR` in api-key mode (the isolated run did that and failed with `Invalid API key`, as expected).

## Not done / follow-ups
- Spike 3 under an API key (no key available).
- Clean-env re-run of the bogus-key-with-login case before any LLD 6.3 change (see the unconfirmed finding under Sign-in).
- koffi load check under the daemon runtime; owner approval to add the package.
- Spike 2 beyond 600 s and without the explicit hook `timeout`.
