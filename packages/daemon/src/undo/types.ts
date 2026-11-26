import type { Disposable } from "../bus/index.ts";
import type { Clock } from "../domain/index.ts";
import type { RunResult } from "../grammar/index.ts";
import type { Store, StoreFile, UndoFile } from "../store/index.ts";

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

export interface UndoJournalDeps {
  store: Store;
  file: StoreFile<UndoFile>;
  clock: Clock;
  /** Reachable from a remote-tracking ref (git `isPushed`). */
  isPushed: (repoId: string, sha: string) => Promise<boolean>;
}
