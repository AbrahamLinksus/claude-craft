import type { AnyCommandHandler } from "@craft/protocol";
import { notBuilt } from "../domain/index.ts";
import type { GrammarDef } from "../grammar/index.ts";
import { FileUndoJournal } from "./journal.ts";
import type { UndoJournal, UndoJournalDeps } from "./types.ts";

export type { UndoEntry, UndoJournal, UndoJournalDeps, UndoResult } from "./types.ts";

/**
 * Without `deps` (main.ts does not pass them yet) every call fails loudly.
 * With them, entries live in `state/undo.json`.
 */
export function createUndoJournal(deps?: UndoJournalDeps): UndoJournal {
  return deps === undefined ? notBuilt<UndoJournal>("undo") : new FileUndoJournal(deps);
}

/** The core `u` binding; add it with `registry.add(undoGrammar(journal), "core")`. */
export function undoGrammar(journal: UndoJournal): GrammarDef {
  return { bindings: [{ verb: "u", object: null, owner: "core", run: () => journal.undoLast() }] };
}

export function commands(): AnyCommandHandler[] {
  return [];
}
