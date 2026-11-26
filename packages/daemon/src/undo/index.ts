import type { AnyCommandHandler } from "@craft/protocol";
import type { Disposable } from "../bus/index.ts";
import { notBuilt } from "../domain/index.ts";
import type { RunResult } from "../grammar/index.ts";

export interface UndoEntry {
  id: string;
  kind: "merge" | "prune" | "pick";
  owner: string;
  label: string;
  repoId: string;
  createdAt: string;
  /** Shas that must not be reachable from a remote-tracking ref. */
  pushCheck: string[];
  payload: unknown;
}

/** LLD 10.4: undo returns the grammar's `RunResult`, so a failure carries its code (ALREADY_PUSHED, UNDO_UNAVAILABLE). */
export type UndoResult = RunResult;

export interface UndoJournal {
  /** Keeps the last 20 in state/undo.json. */
  record(e: Omit<UndoEntry, "id" | "createdAt">): Promise<void>;
  onUndo(
    owner: string,
    kind: UndoEntry["kind"],
    handler: (payload: unknown) => Promise<UndoResult>,
  ): Disposable;
  /** A pushed sha gives ALREADY_PUSHED and keeps the entry. */
  undoLast(): Promise<UndoResult>;
}

/** Placeholder until the undo task. */
export function createUndoJournal(): UndoJournal {
  return notBuilt<UndoJournal>("undo");
}

export function commands(): AnyCommandHandler[] {
  return [];
}
