# Research — Craft (checked 2026-11-25)

Input to the owner's Tier 1 decisions. Every claim has a source URL. "Unverified" marks anything I could not confirm from a source and that a spike must test. Tags: `toolkit` = lint/format/type check/test/version pin; `trade-off` = a wrong choice costs more than a day.

## 0. Findings that change the HLD (read first)
1. **Subscription sign-in is not clearly allowed** (section 2). Official text forbids third-party apps from offering claude.ai login or routing requests through subscription credentials. One carve-out may cover Craft only if Craft never touches credentials and runs the unmodified bundled binary. Ask Anthropic before M3.
2. **The official rate-limit type is missing fields the spec relies on** (section 1.2). Docs declare `status`, `resetsAt`, `utilization` only. `rateLimitType` and the per-bucket `unifiedWindows` (5-hour and weekly) exist in live events but are undocumented and untyped. Spike 3 must pin them with a contract test.
3. **A Node named pipe is NOT current-user-only by default on Windows** (section 3.3). The Windows default pipe ACL grants read to Everyone. The HLD claim "reachable only by the current user" needs an extra token handshake, or a tested ACL workaround.
4. **TypeScript 7.0 (native compiler) has no programmatic API.** Tools such as typescript-eslint and dependency-cruiser cannot use it yet. Pin TypeScript 6.0.x for the toolchain (section 4).
5. **Node has no built-in Windows job object.** HLD spike 5 needs a helper (native addon/FFI or tiny helper exe), wired in through the SDK's `spawnClaudeCodeProcess` option (section 1.5).

---

## 1. Claude Agent SDK (TypeScript)

**Current version:** `@anthropic-ai/claude-agent-sdk` **0.3.332** (bundles Claude Code 2.1.332). ESM only. Node >= 18.14. Peer deps: `zod ^4.0.0`, `@anthropic-ai/sdk >=0.93.0`, `@modelcontextprotocol/sdk ^1.29.0`. Ships platform binaries as optional deps, including `win32-x64`, so no separate Claude Code install is needed. Licence field is "SEE LICENSE IN README.md" (Anthropic terms, not an open-source licence); use is governed by Commercial Terms. Source: https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/latest and https://code.claude.com/docs/en/agent-sdk/overview

Still 0.x, so the API moves: the V2 session API was removed in 0.3.142 (https://code.claude.com/docs/en/agent-sdk/sessions). Pin an exact version and keep the single AgentPort adapter (HLD C2a).

### 1.1 Streaming messages
- `query({prompt, options})` returns an async iterable. For multi-turn, pass an `AsyncIterable<SDKUserMessage>` as `prompt` or call `streamInput()`. `interrupt()`, `setPermissionMode()`, `setModel()` work only in this streaming-input mode. Source: https://code.claude.com/docs/en/agent-sdk/typescript
- Token-level text: set `includePartialMessages: true` to get `stream_event` messages (`BetaRawMessageStreamEvent`). `parent_tool_use_id` is always null on them, so subagent text must come from complete messages. Same source.
- Whole messages: `assistant` (with `BetaMessage`, `parent_tool_use_id`, `agent_id`), `user`, `result`, `system` (init, status, task_*, hook_*), `tool_progress` (a heartbeat every 30 s while a tool runs, v0.3.214+), `rate_limit_event`. Same source.
- Session state: `SDKSessionStateChangedMessage` (`idle`, `running`, `requires_action`) only when env `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1`. Same source. Useful for the "held" badge.
- Mapping to Craft events (AgentText, ToolStarted, ToolFinished, SubagentStarted, TurnFinished, RateLimit) is straightforward; `task_started` carries `task_type: "local_agent"` for subagents.

### 1.2 `rate_limit_event`
Official type (https://code.claude.com/docs/en/agent-sdk/typescript, section `SDKRateLimitEvent`):
```
{ type: "rate_limit_event",
  rate_limit_info: { status: "allowed"|"allowed_warning"|"rejected",
    resetsAt?: number, utilization?: number,
    errorCode?: "credits_required", canUserPurchaseCredits?, hasChargeableSavedPaymentMethod?, overageEnabled? },
  uuid, session_id }
```
Observed live event (SDK 0.3.257, Claude Code 2.1.259), reported in https://github.com/anthropics/claude-code/issues/91857 :
```
rate_limit_info: { status:"allowed", resetsAt:1788465600, rateLimitType:"five_hour",
  overageStatus:"allowed", overageResetsAt:1790812800, isUsingOverage:false,
  unifiedWindows:{ five_hour:{utilization:0.24, resetsAt:1788465600},
                   seven_day:{utilization:0.13, resetsAt:1789005600} } }
```
Answers:
- **Both 5-hour and weekly?** Yes in practice, through `unifiedWindows.five_hour` and `.seven_day`, and also on ordinary turns at status `allowed` (same issue). But `unifiedWindows` and `rateLimitType` are **not in the published typings**; the issue asking to declare them was closed "not planned" by a stale bot on 2026-11-08. So they can vanish or change without notice.
- Top-level `utilization` is absent at status `allowed` and only set after a warning threshold (issue 91857; https://github.com/pingdotgg/t3code/pull/28869 describes the same).
- `resetsAt` looks like Unix seconds (10-digit values), `utilization` a 0-1 fraction that can exceed 1. Units are inferred, not documented.
- Events fire when a window's whole-percent value changes (t3code PR above), so no event arrives on idle sessions: the "out of date - last seen" state (G-21) is needed.
- Unverified: whether the event is emitted at all under API-key auth. Spike 3 should run both sign-in modes.
- Fallback "usage unknown" and a contract test are the right plan (HLD already has them). Read `unifiedWindows` structurally, never rely on the types.

### 1.3 Permission callback / hooks (radar hold)
- `canUseTool(toolName, input, options) => Promise<PermissionResult | null>`; options: `signal`, `suggestions`, `toolUseID`, `agentID`, `requestId`, `blockedPath`, `decisionReason`. Allow: `{behavior:"allow", updatedInput?}`; deny: `{behavior:"deny", message, interrupt?}`. Source: https://code.claude.com/docs/en/agent-sdk/typescript
- **Can it wait for minutes? Yes.** Official: "The callback can stay pending indefinitely. Execution remains paused until your callback returns." For waits longer than the process should live, register a `PreToolUse` hook returning the `defer` decision so the process can exit and resume from the persisted session. Source: https://code.claude.com/docs/en/agent-sdk/user-input
- Important: `canUseTool` runs **only when the permission flow falls through to a prompt**; it is skipped for calls approved by `allowedTools`, allow rules, or the permission mode (e.g. file edits in `acceptEdits`). To see every call (radar needs all Edit/Write calls), use a **`PreToolUse` hook**, which can allow, deny or modify. Source: user-input page above. Design consequence: C4 must be built on `PreToolUse` hooks, with `canUseTool` as the fallback. (HLD currently says "wraps the permission callback".)
- Returning `null` blocks the call forever unless a `control_response` was sent by hand. Avoid.
- The "held too long" fallback (spike 2) is therefore probably unneeded; still test 10 min on Windows. Unverified: any hidden timeout in the bundled binary's control channel.
- `AskUserQuestion` also arrives through `canUseTool` and is unavailable in subagents. Same page.

### 1.4 Resume and fork at a message
- `resume: <sessionId>`, `continue: true`, `forkSession: true` (new session id on resume), `resumeSessionAt: <message uuid>`, `resumeDropsTurn` (needs Claude Code >= 2.1.223). Source: https://code.claude.com/docs/en/agent-sdk/typescript
- Standalone `forkSession()` function copies a transcript to a new session; `upToMessageId` forks from an earlier message; **the fork does not carry file checkpoints**. Same source. So spike 1 likely passes for conversation; the repo state comes from Craft's per-turn commits (worktree at turn N's commit), as the HLD plans.
- Forking branches history, not the filesystem (https://code.claude.com/docs/en/agent-sdk/sessions).
- Transcripts live in `~/.claude/projects/<encoded-cwd>/*.jsonl`; the lookup key derives from the working directory. Craft worktrees are new directories, so a fork into a new worktree must use a lookup that finds the source session: since v2.1.223 the lookup searches beyond the current project dir. A `sessionStore` adapter exists to mirror transcripts (https://code.claude.com/docs/en/agent-sdk/session-storage). Unverified on Windows with worktree paths; include in spike 1.
- `persistSession: false` exists but Craft needs persisted sessions for resume (and keeps its own JSONL as source of truth).

### 1.5 Child processes on Windows and cleanup
- The SDK runs a Claude Code native binary (optional dep `win32-x64`/`win32-arm64`) as a child process, one per `query()`. `pathToClaudeCodeExecutable` overrides it; `spawnClaudeCodeProcess(options) => SpawnedProcess` lets the host control spawning; `abortController` and `query.close()` terminate the process and clean up. Source: https://code.claude.com/docs/en/agent-sdk/typescript
- The docs say nothing about job objects or crash cleanup. If the daemon is killed, children can survive (inferred; this is spike 5).
- Windows facts: a job with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` terminates all members when the last handle closes, which the kernel does on parent death (https://learn.microsoft.com/windows/win32/procthread/job-objects, via search result; and libuv uses the flag for its own global job, https://github.com/libuv/libuv/blob/v1.x/src/win/process.c). Node exposes no API to create a job, so you need a native addon or FFI (for example koffi) or a small helper exe; assign the child suspended, then resume, so it cannot escape first. Detached or breakaway children leave the job.
- Recommended plan: use `spawnClaudeCodeProcess` to spawn each child and put it in one daemon-owned job; also write child PIDs to the daemon state file and sweep at start (the HLD fallback). Which of the two is lower risk is for spike 5.

### 1.6 Cost and token fields
- `SDKResultMessage`: `total_cost_usd` (an estimate, "not a billing statement"), `usage` (main loop only, excludes subagents), `modelUsage` per model including subagents ("prefer modelUsage"), `duration_ms`, `duration_api_ms`, `num_turns`, `permission_denials`, `is_error`, `subtype`. In streaming-input sessions the totals are cumulative across turns, so read the latest result rather than summing. Source: https://code.claude.com/docs/en/agent-sdk/typescript
- Per-message `assistant.message.usage` gives incremental tokens. Cost under a subscription login is a notional estimate (unverified for subscription logins; spike 3).

### 1.7 Recommendations (section 1)
| Item | Choice | Tag |
|---|---|---|
| SDK pin | `@anthropic-ai/claude-agent-sdk` exact 0.3.332, licence: Anthropic terms (README) | trade-off |
| Permission interception | `PreToolUse` hooks as the primary chain, `canUseTool` as fallback | trade-off |
| Rate-limit reader | structural reader of `rate_limit_info` incl. `unifiedWindows`, contract test, "unknown" | trade-off |
| Process cleanup | job object via `spawnClaudeCodeProcess` + PID sweep | trade-off |

---

## 2. Subscription login in third-party apps (spec risk #1)

What the official documents say, plainly:
1. Agent SDK overview: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead." Source: https://code.claude.com/docs/en/agent-sdk/overview
2. Legal and compliance: OAuth "is intended exclusively for purchasers of ... subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications." Developers building products that interact with Claude, "including those using the Agent SDK, should use API key authentication". "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens - sign-in to a Claude account must complete through Anthropic's own flow." Source: https://code.claude.com/docs/en/legal-and-compliance
3. Carve-out in the same page: the restriction does not stop "an end user from signing in to the unmodified Claude Code binary with their own Claude subscription", including where a platform hosts Claude Code. Conditions for embedding Claude Code: the binary must not be modified, no authentication method may be removed or restricted, and each end user authenticates with their own credentials; no reselling. Same page.
4. Plan limits: "Advertised usage limits for Pro, Max, and Ultra plans assume ordinary, individual usage of Claude Code and the Agent SDK." Same page. Craft's design (5 own + 8 team agents, keep-warm pings) may exceed "ordinary".
5. Anthropic "reserves the right to take measures to enforce these restrictions ... without prior notice." Same page. Contact route given: https://www.anthropic.com/contact-sales

How this reads for Craft (my reading, not legal advice):
- Craft run by the owner on the owner's PC, using the SDK's bundled unmodified binary, where the owner signs in through Anthropic's own flow (for example by running the `claude` login once), is closest to the carve-out. It is not "offering login on behalf of users" as long as Craft never reads, stores or forwards the tokens.
- Craft being a public repo others install is the grey area: the overview note says third parties may not "offer claude.ai login ... for their products". The document does not say whether an open-source tool that each user runs locally counts.
- Hard rules that keep Craft on the safe side: no custom login screen or token handling, never read `~/.claude` credential files, never alter the binary, keep the API key as the documented default for anyone but the owner.
- Branding: do not use "Claude Code" in product text; "Claude Agent" or "Powered by Claude" are allowed (overview page). "Craft" is fine; the repo name `claude-craft` is a judgment call.

Recommendation: keep D-03 (subscription default, API key fallback) for the owner's own machine, add the hard rules above to the spec, and email Anthropic sales for written confirmation before any public release. **DECISION relevant for the owner (Tier 1):** whether the public README presents subscription login as supported. Cost of being wrong: an hour to change the default, but account action by Anthropic is possible.

---

## 3. Desktop shell, pipe, Windows IPC

### 3.1 Electron vs Tauri
| | Electron | Tauri |
|---|---|---|
| Latest | 45.5.0 (2026-11-24), Chromium 156, Node 24.22.3 built in; MIT. Sources: https://registry.npmjs.org/electron/latest , https://releases.electronjs.org/release/v45.5.0 | `@tauri-apps/cli` 2.12.6, Apache-2.0 OR MIT. Source: https://registry.npmjs.org/@tauri-apps/cli/latest |
| Support policy | Latest three stable majors get fixes; only the newest minor of each (https://www.electronjs.org/docs/latest/tutorial/electron-timelines) | Not checked |
| Runtime | Own Chromium, same on every PC | Windows WebView2 (Chromium-based, system installed) |
| Idle memory | Blog figures conflict (168 vs 42 MB in one; 128 vs 109 MB in another; no Windows-specific independent data). Sources: https://tech-insider.org/tauri-vs-electron-2026/ , https://betterstack.com/community/guides/scaling-nodejs/tauri-vs-electron-vs-deno-vs-electrobun.md . Treat as unproven; spike 4 measures. WebView2 is Chromium so the gap shrinks on Windows (https://github.com/tauri-apps/tauri/issues/5889) | |
| Shell reaches pipe | `net.connect('\\\\.\\pipe\\...')` in the main process, same language and zod schemas as the daemon | Needs Rust code for the pipe client (tokio has a Windows named-pipe module; not verified from a source here) plus a bundled Node runtime for the daemon as a sidecar. Sources: https://v2.tauri.app/develop/sidecar |
| Windows packaging | electron-builder 26.18.0 (MIT) or Forge 8.0.1 (MIT) | Built-in NSIS/MSI bundler; one user reports NSIS not replacing a running sidecar on reinstall (https://github.com/tauri-apps/tauri/issues/15134) and orphan sidecars if the app does not kill them (https://jonaskruckenberg.github.io/tauri-docs-wip/examples/sidecar.html) |
| Installer size | ~100+ MB (unverified figure) | much smaller (unverified) |

Extra Electron point: the daemon can run on Electron's own Node via `ELECTRON_RUN_AS_NODE=1`, so no second Node needs shipping. This only works if the `runAsNode` fuse stays enabled (default); with it off, `child_process.fork` fails and Electron recommends Utility Processes. Source: https://www.electronjs.org/docs/latest/tutorial/fuses . Trade-off: the daemon then runs the Node version bundled by Electron (24.22.3), and its lifetime is tied to that exe (updating the app replaces the binary the daemon is running from; start a daemon version check in the hello).

**Recommendation: Electron 45.x** (matches D-15 lean). Reason: pipe, daemon launch and protocol code stay in TypeScript; Tauri's memory advantage on Windows is unproven and WebView2 is Chromium anyway. Re-check with spike 4 numbers (5 streaming panes + canvas graph; typing < 50 ms). Tag: `trade-off`. If spike 4 shows Electron over budget, Tauri costs one Rust bridge file plus a Node sidecar; rework of client shell about days.

### 3.2 Node `net` on Windows
- `net.createServer().listen('\\\\.\\pipe\\name')` and `net.connect` support Windows named pipes (standard Node feature; pipe paths must start with `\\.\pipe\`). No Node doc fetched, so the exact doc quote is unverified; spike "+ Windows connection" proves reconnect after daemon restart.
- libuv names pipe instances; only one server can own a name, so "single instance by owning the pipe name" works (listen fails with EADDRINUSE; unverified on Windows, test it).

### 3.3 Pipe access control (HLD gap)
- The Windows default descriptor for a pipe "grant[s] full control to the LocalSystem account, administrators, and the creator owner. They also grant read access to members of the Everyone group and the anonymous account." Source: https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights . The same page says to use the logon SID in the DACL to keep out remote users and other sessions.
- Node: issue "Can't change NamedPipe permissions with Windows" closed as not planned. Options `readableAll` / `writableAll` exist for `listen()`, but setting both `false` does not change permissions; the thread suggests `server._handle.fchmod(0)` (internal API) or `fs.chmod(PIPE_PATH, 0)`, not confirmed to work. Source: https://github.com/nodejs/node/issues/47086
- **Recommendation:** do not rely on the ACL. Name the pipe `\\.\pipe\craft-<username>`, and in `hello` require a random token read from a file in `%USERPROFILE%\.craft` (user-profile folder permissions protect it, unverified for this machine's profile ACL) plus a protocol version. Treat the fchmod workaround as an optional extra tested in spike "+". Tag: `trade-off` (security promise in SPEC §9/HLD). A second Windows user account on the test PC proves it.

---

## 4. Versions to pin (checked on npm registry 2026-11-25)

| Package | Pin | Licence | Why | Alternative | Tag |
|---|---|---|---|---|---|
| Node.js | 24.22.3 (LTS "Krypton") | MIT | Same major as Electron 45's built-in Node and the Node used to publish the SDK; avoids ABI/behaviour drift between tests and daemon. Source: https://nodejs.org/en/about/previous-releases | 26.13.1 (LTS "Lithium") if Electron moves to Node 26; 22.23.5 is the floor for most tooling | toolkit |
| TypeScript | 6.0.x (latest 6.0 patch at install; >= 6.0.3 exists) | Apache-2.0 | typescript-eslint 8.74.0 peer range is `>=4.8.4 <6.1.0`; dependency-cruiser tests with ^6.0.3 and lists support for 7.1+ only. 7.0.2 is the npm `latest` but ships no compiler API (https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), 7.1 beta restores a new API, stable tentatively late Nov (https://infoq.com/news/2026/11/typescript-7-1-beta) | TypeScript 7.0.2 for `tsc` only via the compatibility package, side by side; revisit after 7.1 stable | toolkit |
| Electron | 45.5.0 | MIT | section 3.1 | Tauri 2.12.x | trade-off |
| React | 19.3.1 (+ react-dom same) | MIT | current; peer of the virtual list lib | none needed | toolkit |
| zod | 4.6.7 | MIT | SDK needs `zod ^4` as peer, so one version across repo | zod 3 (no: conflicts with SDK peer) | toolkit |
| vitest | 5.1.1 | MIT | owner decision; Node `^22.12 || ^24 || >=26` | none | toolkit |
| dependency-cruiser | 18.9.0 | MIT | owner decision; Node `^22 || ^24 || >=26` | none | toolkit |
| Vite (client bundler) | 8.3.8 | MIT | Node `^20.19 || >=22.12`; standard React build | electron-vite wrapper (not checked) | toolkit |
| Virtualized list | `@tanstack/react-virtual` 3.14.28 | MIT | headless, supports dynamic row heights and React 19 peer; works with a mono grid look | `react-virtuoso` 4.18.24 (MIT): ready-made chat/"follow output" behaviour, less control of grid | trade-off |
| Branch graph / mono grid | Own Canvas 2D character-cell renderer (no library) | n/a | The look is a fixed-cell mono grid (SPEC §7); a graph of ~tens of branches is small. Avoids a DOM-graph lib fighting the grid | `@xterm/xterm` 6.0.0 (MIT) with its renderer for a ready cell grid but terminal semantics; `@xyflow/react` 13.0.3 (MIT) for node-link graphs in DOM, not mono-grid | trade-off |
| Package manager / monorepo | pnpm 12.23.0 workspaces (MIT), no Turborepo/Nx | MIT | Packages: protocol, daemon, graft-api, client, grafts/*; dependency-cruiser enforces the layers; task running by pnpm scripts is enough for one developer | npm workspaces; Turborepo only if build time hurts | toolkit |
| Windows packager | electron-builder 26.18.0 (NSIS installer) | MIT | one config, NSIS per-user install, widely used | `@electron-forge/cli` 8.0.1 (MIT) | trade-off |
| Lint + format | Biome 2.6.9 (MIT or Apache-2.0) | | Fast, no dependency on the TypeScript compiler API, so it is unaffected by the TS 7 gap | ESLint + typescript-eslint 8.74.0 (MIT) + Prettier; fits cognitive-complexity rules but needs TS < 6.1 | toolkit (not yet decided by owner; Tier 1 as a package choice) |
| Agent SDK | 0.3.332 | Anthropic terms | section 1 | none | trade-off |
| Atomic file writes | `write-file-atomic` (version to confirm at install) for config/state snapshots | ISC | handles Windows rename retries via graceful-fs (https://github.com/npm/write-file-atomic/pull/29) | own temp+rename with EPERM/EACCES retry | toolkit |

Notes: versions come from `https://registry.npmjs.org/<name>/latest`. Electron's supported-versions policy (latest three majors) means pinning 45 is fine for months, but re-pin when 48 ships. I did not check licences beyond the registry field, nor vulnerability advisories.

---

## 5. Windows file and git gotchas

### 5.1 Append-only JSONL (event log, crash loses at most the last event)
- Node: `filehandle.sync()` flushes to the device via the OS-specific equivalent of fsync; `datasync()` skips metadata. Source: https://nodejs.org/api/fs.html . Under Windows libuv, fsync maps to `FlushFileBuffers` (libuv docs say only "equivalent to fsync(2)": https://docs.libuv.org/en/v1.x/fs.html ; the mapping is from my knowledge, not a fetched source). Microsoft advises not calling it frequently (https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers).
- Node warns that fs operations "are not synchronized or threadsafe" and that `filehandle.write()` must not be called repeatedly without awaiting. Source: https://nodejs.org/api/fs.html
- I found no source stating that O_APPEND writes are atomic on Windows. **Do not rely on it.** Design: one writer (the daemon) per file, an in-process queue per session, one `write` of a whole line ending in `\n`, handle opened with flag `'a'`. On start, read the last line; if it does not parse, truncate that torn tail (this is how "loses at most the last event" holds). `datasync` at TurnFinished and approvals only, not on every text delta (cost). Tag: `trade-off`.
- Rename to replace a file (config, state snapshot): Windows rename does not behave like POSIX; concurrent writes give EPERM/EACCES, also from antivirus or indexers holding the file. Use a single writer per target, async rename with retry and backoff (write-file-atomic with graceful-fs does this). Source: https://github.com/npm/write-file-atomic/pull/29 and https://github.com/isaacs/node-graceful-fs/issues/104
- 50 MB rollover: close and open the next part file between events; never rename the live file.
- Redaction before write for "yes" repos is a pure function; test with a golden file.

### 5.2 git worktrees on Windows
- Path length: Win32 MAX_PATH is 260; opt-in long paths need registry `LongPathsEnabled=1` **and** an app manifest `longPathAware`; Node/Electron/git.exe each need to be aware. Cloning into long folder names is the named example. Source: https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation . Mitigation: keep worktree root short (`%USERPROFILE%\.craft\worktrees\<repoid>\<n>`; use a short hash for repo-id), and run git with `-c core.longpaths=true` (documented Git for Windows setting; git-config page not fully read, so verify). Warn at first run if `LongPathsEnabled` is 0.
- `git worktree remove` refuses unclean worktrees without `--force`, and locked ones without two `--force`. A deleted-by-hand worktree leaves admin files pruned later by `gc.worktreePruneExpire` or `git worktree prune`. `git worktree lock` writes a `locked` file. `git worktree repair` fixes moved paths. Source: https://git-scm.com/docs/git-worktree . Use `lock --reason "craft session sN"` on creation so a stray `git gc/prune` cannot drop an unmounted one, and never run `--force` remove without the owner's "d".
- File locks: Windows refuses to delete a directory containing files open by any process (a running SDK child with that cwd, an editor, antivirus, a file watcher). Stop the session's SDK process and the watcher first, then retry `remove` with backoff; surface "in use by X" rather than force. (Windows behaviour from general knowledge; the Node `fs.rm` `maxRetries` doc was not retrievable.) A `.git` worktree pointer uses absolute paths by default; `worktree.useRelativePaths` is opt-in and breaks older gits (git-worktree doc).
- Status calls: `--no-optional-locks` (already in HLD) avoids index.lock contention with the per-repo write queue.
- Unverified: behaviour of `core.fsmonitor`/untracked cache on Windows for 5 worktrees; test in M5.

---

## 6. Open items for the spikes (not answered by sources)
1. O_APPEND atomicity and FlushFileBuffers cost on this PC (event log).
2. Hidden timeout on a held PreToolUse hook / canUseTool beyond 10 minutes (spike 2).
3. Whether `rate_limit_event` appears under API-key login; `unifiedWindows` stability across 0.3.257 to 0.3.332 (spike 3).
4. Fork across worktree directories finds the session file (spike 1).
5. Job-object helper approach and its Electron packaging (spike 5).
6. Pipe: single-instance, reconnect, second Windows user, token handshake (spike +).
7. Memory and typing latency numbers, Electron vs Tauri (spike 4).
8. Written answer from Anthropic on subscription login for a public local tool (before M3).
