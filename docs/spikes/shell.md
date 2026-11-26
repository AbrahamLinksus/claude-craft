# Spike 4: Electron vs Tauri on Windows 11

Owner decision D-23: "Electron only (Recommended)". Tauri was not built or measured; that acceptance criterion is waived.

## Setup
- Machine: Windows 11 Home 10.0.26200 (60 Hz display, so one frame is about 16.7 ms).
- Shell: Electron 45.5.0 (Chromium 156.0.8078.109), `spikes/shell/electron/` loading `spikes/shell/web/index.html`.
- Load: 5 replayed streaming transcripts (about 300 lines/s total, 60-line window each) plus a canvas branch graph redrawn every 33 ms, on the 14px/20px mono grid. Screenshot (from run 3): `.results/T-03/shell/electron-run3.png`.
- Probe: 200 keystrokes (`--auto=200`, 40-70 ms apart after a 3 s warmup); keydown handler entry to the first task after the next animation frame (`web/bench.js`). Synthetic keydown events, not OS-level SendInput.
- Memory: `app.getAppMetrics()` in the main process, 1.5 s after the run ended (streams still running); sum over all Electron processes.
- Runs: 5 full runs (fresh process each); run 5 is the tester's independent re-run.

## Results (Electron)

| Run | n | p50 ms | p95 ms | p99 ms | max ms | Working set MB | Private MB |
|---|---|---|---|---|---|---|---|
| 1 | 204 | 4.6 | 18.4 | 18.8 | 19.3 | 386.9 | 248.1 |
| 2 | 200 | 4.1 | 18.2 | 18.8 | 19.1 | 392.8 | 252.7 |
| 3 (earlier) | 200 | 2.4 | 17.9 | 18.2 | 18.5 | 396.3 | 253.5 |
| 4 (earlier) | 200 | 2.3 | 17.8 | 19.4 | 19.8 | 387.1 | 246.3 |
| 5 (tester re-run, raw: `.results/T-03/electron-run-a.json`) | 600 | 2.0 | 17.3 | 17.7 | 19.1 | 400.0 | 256.9 |

Runs 3 and 4 were taken before the pipe field was added to the output; their raw files were overwritten, figures are from the console. Worst p95 is 18.4 ms (runs 1-5) against the 50 ms budget (SPEC §9).

Per-process (run 2): Browser 101 MB WS / 36 MB private; GPU 97 / 111; Utility 47 / 12; Renderer (Tab) 148 / 94. Total about 390 MB working set, about 250 MB private.

| Shell | p95 key-to-paint | Memory | Pipe round trip |
|---|---|---|---|
| Electron 45.5.0 | 17.3-18.4 ms (pass, < 50 ms) | about 390 MB WS / about 250 MB private | OK, 3.6-4.0 ms |
| Tauri | not measured (owner decision D-23) | not measured (owner decision D-23) | not measured (owner decision D-23) |

## Named-pipe round trip (main process)
`main.js` starts a `net` server on the Windows named pipe `\.\pipe\shell-spike-<pid>` and a `net.connect` client to it, both in the main process; the renderer triggers it over IPC (`preload.js` bridge `pipeRoundTrip`). One JSON line, newline-framed:

- sent: `{"t":"ping","id":1,"ts":1795660993579}`
- got: `{"t":"pong","id":1,"echo":{"t":"ping","id":1,"ts":1795660993579},"server_pid":24592}` (3.6 ms)

Limits: client and server are in the same process, so this proves Node's pipe API and framing work in Electron's main process on Windows, not a separate daemon process.

## Recommendation
Keep Electron. p95 key-to-paint is about 18 ms (roughly one frame) with 5 streams and the canvas graph, well under 50 ms, and the main process reaches a named pipe with plain Node `net`. The Tauri fallback (LLD section 0.7: only `client/src/main/` rewritten) is not needed.

Caveat: the probe measures to the frame after the next paint using synthetic events; real-keyboard latency adds OS and input-stack time outside the app (typically a few ms to tens of ms), so the remaining margin of about 30 ms (50 ms budget minus ~18 ms) is an estimate, not measured end to end.
