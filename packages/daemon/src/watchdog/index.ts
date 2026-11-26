import type { AnyCommandHandler } from "../../../protocol/src/index.ts";

export interface Watchdog {
  /** Event-loop delay monitor: p99 > 100 ms over 10 s gives a log line and a Notice (LLD 16.2). */
  start(): void;
  stop(): void;
}

/** Placeholder until the stability task: does nothing. */
export function createWatchdog(): Watchdog {
  return { start: () => undefined, stop: () => undefined };
}

export function commands(): AnyCommandHandler[] {
  return [];
}
