import type { ChildProcess } from "node:child_process";
import {
  CraftError,
  type AnyCommandHandler,
  type SessionKey,
} from "../../../protocol/src/index.ts";

export {
  OwnerOnlyAcl,
  ProcessRunner,
  type CommandResult,
  type CommandRunner,
  type FileRunner,
} from "./command-runner.ts";

/** Handle the SDK gets back from `ProcessReaper.spawn` (LLD 6.4). */
export type SpawnedProcess = ChildProcess;

/** What the SDK's `spawnClaudeCodeProcess` hands over: one options object (LLD 6.4). */
export interface SpawnOptions {
  command: string;
  args: string[];
  cwd?: string;
  env: Readonly<Record<string, string | undefined>>;
  signal: AbortSignal;
}

export interface ProcessReaper {
  /** Windows: tier B self-job if enabled; then sweep. */
  init(): Promise<void>;
  /** Passed to the SDK as `spawnClaudeCodeProcess`. */
  spawn(opts: SpawnOptions): SpawnedProcess;
  /** Also used by the command runner and the git worker. */
  track(child: ChildProcess, sid?: SessionKey): void;
  /** Kill recorded children of a dead daemon; returns how many were killed. */
  sweepOrphans(): Promise<number>;
}

/** Placeholder until the reaper task: tracks nothing and refuses to spawn. */
export function createProcessReaper(): ProcessReaper {
  return {
    init: () => Promise.resolve(),
    spawn: () => {
      throw new CraftError("INTERNAL", {}, { module: "process", reason: "reaper not built yet" });
    },
    track: () => undefined,
    sweepOrphans: () => Promise.resolve(0),
  };
}

/** The process module owns no commands yet. */
export function commands(): AnyCommandHandler[] {
  return [];
}
