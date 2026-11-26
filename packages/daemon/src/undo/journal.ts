import { describeError, isCraftError } from "@craft/protocol";
import type { Disposable } from "../bus/index.ts";
import type { UndoEntry, UndoJournal, UndoJournalDeps, UndoResult } from "./types.ts";

export const UNDO_LIMIT = 20;

type Handler = (payload: unknown) => Promise<UndoResult>;

function failure(error: unknown): UndoResult {
  if (isCraftError(error)) return { ok: false, code: error.code, message: error.userMessage };
  return { ok: false, code: "INTERNAL", message: describeError("INTERNAL") };
}

function handlerKey(owner: string, kind: UndoEntry["kind"]): string {
  return `${owner}\u0000${kind}`;
}

/** The last 20 undoable actions, kept in `state/undo.json` so a daemon restart keeps them. */
export class FileUndoJournal implements UndoJournal {
  private readonly handlers = new Map<string, Handler>();
  private readonly deps: UndoJournalDeps;
  private nextId = 1;
  /** One writer: every record and undo runs after the one before it. */
  private tail: Promise<unknown> = Promise.resolve();

  constructor(deps: UndoJournalDeps) {
    this.deps = deps;
  }

  record(e: Omit<UndoEntry, "id" | "createdAt">): Promise<void> {
    return this.serial(async () => {
      const entries = await this.load();
      const now = this.deps.clock.now();
      const id = `u${String(now.getTime())}-${String(this.nextId++)}`;
      const entry: UndoEntry = { ...e, id, createdAt: now.toISOString() };
      await this.save([...entries, entry].slice(-UNDO_LIMIT));
    });
  }

  onUndo(owner: string, kind: UndoEntry["kind"], handler: Handler): Disposable {
    const key = handlerKey(owner, kind);
    this.handlers.set(key, handler);
    return {
      dispose: () => {
        if (this.handlers.get(key) === handler) this.handlers.delete(key);
      },
    };
  }

  undoLast(): Promise<UndoResult> {
    return this.serial(async () => {
      const entries = await this.load();
      const last = entries.at(-1);
      if (last === undefined) {
        return { ok: false, code: "UNDO_UNAVAILABLE", message: "nothing to undo" };
      }
      if (await this.pushed(last)) {
        return { ok: false, code: "ALREADY_PUSHED", message: describeError("ALREADY_PUSHED") };
      }
      const result = await this.run(last);
      if (result.ok) await this.save(entries.slice(0, -1));
      return result;
    });
  }

  private async pushed(entry: UndoEntry): Promise<boolean> {
    for (const sha of entry.pushCheck) {
      if (await this.deps.isPushed(entry.repoId, sha)) return true;
    }
    return false;
  }

  private async run(entry: UndoEntry): Promise<UndoResult> {
    const handler = this.handlers.get(handlerKey(entry.owner, entry.kind));
    if (handler === undefined) {
      const message = describeError("UNDO_UNAVAILABLE", { graft: entry.owner });
      return { ok: false, code: "UNDO_UNAVAILABLE", message };
    }
    try {
      return await handler(entry.payload);
    } catch (error) {
      return failure(error);
    }
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work, work);
    this.tail = next.catch(() => undefined);
    return next;
  }

  private async load(): Promise<UndoEntry[]> {
    return (await this.deps.store.load(this.deps.file)).entries;
  }

  private async save(entries: UndoEntry[]): Promise<void> {
    await this.deps.store.save(this.deps.file, { schema: 1, entries });
  }
}
