import { spawn, type ChildProcess } from "node:child_process";
import type { SessionKey } from "@craft/protocol";
import type { Logger } from "../log/index.ts";
import type { ChildrenLedger } from "./children-ledger.ts";
import { CREATION_TOLERANCE_MS } from "./constants.ts";
import { enableSelfJob } from "./job-object.ts";
import type { ProcessProbe } from "./probe.ts";

/** What `ProcessReaper.spawn` receives (the SDK's `spawnClaudeCodeProcess` options). */
export interface SpawnOptions {
  command: string;
  args: string[];
  cwd?: string;
  env: Readonly<Record<string, string | undefined>>;
  signal: AbortSignal;
}

export interface ReaperDeps {
  ledger: ChildrenLedger;
  probe: ProcessProbe;
  log: Logger;
  platform: NodeJS.Platform;
  /** Tier B self-job on Windows (default on). */
  selfJob?: boolean;
  /** Replaces the koffi loader (tests). */
  loadKoffi?: () => Promise<unknown>;
}

function sameInstant(a: string, b: string): boolean {
  return Math.abs(Date.parse(a) - Date.parse(b)) <= CREATION_TOLERANCE_MS;
}

export class Reaper {
  private readonly d: ReaperDeps;
  private readonly live = new Set<ChildProcess>();

  constructor(deps: ReaperDeps) {
    this.d = deps;
  }

  async init(): Promise<void> {
    if (this.d.platform === "win32" && this.d.selfJob !== false) {
      try {
        await enableSelfJob(this.d.loadKoffi);
        this.d.log.info("self job object active (tier B)");
      } catch (error) {
        this.d.log.warn("self job object unavailable; relying on the orphan sweep", {
          error: String(error),
        });
      }
    }
    await this.sweepOrphans();
  }

  spawn(opts: SpawnOptions): ChildProcess {
    const child = spawn(opts.command, opts.args, {
      ...(opts.cwd === undefined ? {} : { cwd: opts.cwd }),
      env: opts.env as NodeJS.ProcessEnv,
      signal: opts.signal,
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
      detached: this.d.platform !== "win32",
    });
    this.track(child);
    return child;
  }

  track(child: ChildProcess, sid?: SessionKey): void {
    const pid = child.pid;
    if (pid === undefined) return;
    this.live.add(child);
    child.once("exit", () => {
      this.live.delete(child);
      void this.d.ledger.remove(pid);
    });
    void this.record(pid, sid);
  }

  /** Kills recorded children of a dead daemon; never a process whose creation time differs. */
  async sweepOrphans(): Promise<number> {
    const recorded = await this.d.ledger.list();
    const alive = await this.d.probe.creationTimes(recorded.map((r) => r.pid));
    let killed = 0;
    for (const r of recorded) {
      const now = alive.get(r.pid);
      if (now === undefined || !sameInstant(now, r.createdAt)) continue;
      if (await this.d.probe.killTree(r.pid)) killed += 1;
    }
    await this.d.ledger.clear();
    this.d.log.info("orphan sweep done", { recorded: recorded.length, killed });
    return killed;
  }

  /** Daemon shutdown: end every child still running (tree kill; group kill off Windows). */
  async shutdown(): Promise<void> {
    const pids = [...this.live].flatMap((c) => (c.pid === undefined ? [] : [c.pid]));
    await Promise.all(pids.map((pid) => this.d.probe.killTree(pid)));
    await this.d.ledger.clear();
  }

  private async record(pid: number, sid: SessionKey | undefined): Promise<void> {
    const created = (await this.d.probe.creationTimes([pid])).get(pid);
    if (created === undefined) return;
    await this.d.ledger.add({ pid, createdAt: created, ...(sid ? { sid } : {}) });
  }
}
