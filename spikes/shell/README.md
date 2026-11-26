# Shell spike UI (shared, no dependencies)

`web/index.html` is loaded by the Electron shell (`loadFile`). No Tauri shell exists (owner decision D-23); the UI is kept shell-neutral.
- `?auto=200`: 200 synthetic keystrokes after a 3 s warmup; result shown and sent to `shellBridge.report`.
- F9 in the input, or `window.spike.summary()`: p50/p95/p99/max keystroke-to-paint (ms) and JS heap.
- `?streams=0`: baseline without the 5 streams.
- Each shell's preload may set `window.shellBridge = { name, pipeRoundTrip(jsonLine) -> Promise<string>, report(obj) -> Promise }`.
  The UI then runs the named-pipe round trip on load and shows the result in the pipe line.
- Latency probe: keydown handler entry to the first task after the next animation frame. Real keystrokes (SendInput) use the same probe.
- Process memory (not just JS heap) is read in the Electron main process via `app.getAppMetrics()`.
