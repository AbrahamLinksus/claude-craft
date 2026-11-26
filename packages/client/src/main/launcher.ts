import { CraftError } from "@craft/protocol";
import { LAUNCH_POLL_MS, LAUNCH_WAIT_MS } from "./constants.ts";

export interface LauncherDeps {
  /** True when something accepts connections on the pipe. */
  probe(): Promise<boolean>;
  /** Start the background worker detached; returns at once. */
  spawnDaemon(): void;
  delay(ms: number, signal: AbortSignal): Promise<void>;
}

/** Starts the background worker when it is not running (LLD 2.1, 2.3). */
export class DaemonLauncher {
  private readonly deps: LauncherDeps;

  constructor(deps: LauncherDeps) {
    this.deps = deps;
  }

  async ensureRunning(signal: AbortSignal = new AbortController().signal): Promise<void> {
    if (await this.deps.probe()) return;
    this.deps.spawnDaemon();
    for (let waited = 0; waited < LAUNCH_WAIT_MS; waited += LAUNCH_POLL_MS) {
      await this.deps.delay(LAUNCH_POLL_MS, signal);
      if (signal.aborted) return;
      if (await this.deps.probe()) return;
    }
    throw new CraftError("INTERNAL", {}, "the background worker did not start in time");
  }
}
