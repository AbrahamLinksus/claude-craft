import type { AnyCommandHandler, LogLine, SessionKey } from "../../../protocol/src/index.ts";
import { notBuilt } from "../domain/index.ts";

export type LogLocation = { kind: "repo"; worktree: string } | { kind: "home"; repoDir: string };

export interface EventLog {
  /** Repairs a torn tail. */
  open(sid: SessionKey, loc: LogLocation): Promise<void>;
  append(sid: SessionKey, type: string, data: unknown): Promise<LogLine>;
  read(sid: SessionKey, opts?: { fromN?: number; types?: string[] }): AsyncIterable<LogLine>;
  turnPoint(sid: SessionKey, turn: number): Promise<{ lastMessageId: string; sha: string | null }>;
  close(sid: SessionKey): Promise<void>;
}

/** Placeholder until the event-log task. */
export function createEventLog(): EventLog {
  return notBuilt<EventLog>("eventlog");
}

export function commands(): AnyCommandHandler[] {
  return [];
}
