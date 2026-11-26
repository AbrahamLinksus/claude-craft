import type { Logger } from "../log/index.ts";
import type { ChildrenFile, Store, StoreFile } from "../store/index.ts";

export type ChildRecord = ChildrenFile["children"][number];

/** `state/children.json`: the one writer. Updates run one after another, never interleaved. */
export class ChildrenLedger {
  private readonly store: Store;
  private readonly file: StoreFile<ChildrenFile>;
  private readonly log: Logger;
  private tail: Promise<void> = Promise.resolve();

  constructor(store: Store, file: StoreFile<ChildrenFile>, log: Logger) {
    this.store = store;
    this.file = file;
    this.log = log;
  }

  async list(): Promise<ChildRecord[]> {
    await this.tail;
    return (await this.store.load(this.file)).children;
  }

  add(record: ChildRecord): Promise<void> {
    return this.update((all) => [...all.filter((c) => c.pid !== record.pid), record]);
  }

  remove(pid: number): Promise<void> {
    return this.update((all) => all.filter((c) => c.pid !== pid));
  }

  clear(): Promise<void> {
    return this.update(() => []);
  }

  private update(change: (all: ChildRecord[]) => ChildRecord[]): Promise<void> {
    this.tail = this.tail.then(async () => {
      try {
        const current = await this.store.load(this.file);
        await this.store.save(this.file, { ...current, children: change(current.children) });
      } catch (error) {
        this.log.error("children.json update failed", { error: String(error) });
      }
    });
    return this.tail;
  }
}
