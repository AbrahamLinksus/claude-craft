import type { ChildProcess } from "node:child_process";
import { CraftError, type AnyCommandHandler, type SessionKey } from "@craft/protocol";
import type { Logger } from "../log/index.ts";
import type { Store, StoreFiles } from "../store/index.ts";
import { ChildrenLedger } from "./children-ledger.ts";
import { Reaper, type SpawnOptions } from "./reaper.ts";
import { SystemProbe } from "./probe.ts";

export {
  OwnerOnlyAcl,
  ProcessRunner,
  type ChildTracker,
  type CommandResult,
  type CommandRunner,
  type FileRunner,
} from "./command-runner.ts";
export type { SpawnOptions };

/** Handle the SDK gets back from `ProcessReaper.spawn` (LLD 6.4). */
export type SpawnedProcess = ChildProcess;

export interface ProcessReaper {
  /** Windows: tier B self-job if enabled; then sweep. */
  init(): Promise<void>;
  /** Passed to the SDK as `spawnClaudeCodeProcess`. */
  spawn(opts: SpawnOptions): SpawnedProcess;
  /** Also used by the command runner and the git worker. */
  track(child: ChildProcess, sid?: SessionKey): void;
  /** Kill recorded children of a dead daemon; returns how many were killed. */
  sweepOrphans(): Promise<number>;
  /** Daemon shutdown: end every child still running. */
  shutdown(): Promise<void>;
}

export interface ProcessReaperOptions {
  store: Store;
  files: StoreFiles;
  log: Logger;
  platform?: NodeJS.Platform;
  /** Tier B self-job on Windows (default on). */
  selfJob?: boolean;
}

/** The real reaper: records children in `state/children.json`, sweeps leftovers at start. */
export function createNodeProcessReaper(opts: ProcessReaperOptions): ProcessReaper {
  const platform = opts.platform ?? process.platform;
  const log = opts.log.child("process");
  return new Reaper({
    ledger: new ChildrenLedger(opts.store, opts.files.children, log),
    probe: new SystemProbe(platform),
    log,
    platform,
    ...(opts.selfJob === undefined ? {} : { selfJob: opts.selfJob }),
  });
}

/** Placeholder kept until `main.ts` calls `createNodeProcessReaper`: tracks nothing, refuses to spawn. */
export function createProcessReaper(): ProcessReaper {
  return {
    init: () => Promise.resolve(),
    spawn: () => {
      throw new CraftError("INTERNAL", {}, { module: "process", reason: "reaper not wired yet" });
    },
    track: () => undefined,
    sweepOrphans: () => Promise.resolve(0),
    shutdown: () => Promise.resolve(),
  };
}

/** The process module owns no commands yet. */
export function commands(): AnyCommandHandler[] {
  return [];
}
