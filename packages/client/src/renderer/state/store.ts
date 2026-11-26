import type { Snapshot, StreamEvent } from "../../../../protocol/src/index.ts";
import type { LinkState } from "../../preload/api.ts";
import { fromSnapshot, initialState, type ClientState } from "./client-state.ts";
import { applyEvent } from "./reducers.ts";

export interface ClientStore {
  getState(): ClientState;
  subscribe(cb: () => void): () => void;
  applySnapshot(snapshot: Snapshot, seq: number): void;
  applyEvents(events: StreamEvent[]): void;
  setLink(link: LinkState): void;
  lastSeq(): number;
}

/** Runs `cb` once, soon: `requestAnimationFrame` in the window, a timer in tests. */
export type Scheduler = (cb: () => void) => void;

/** The window's copy of the worker state; events apply in one batch per frame (LLD 13.2). */
export class CraftStore implements ClientStore {
  private state = initialState();
  private seq = 0;
  private queue: StreamEvent[] = [];
  private scheduled = false;
  private readonly listeners = new Set<() => void>();
  private readonly schedule: Scheduler;

  constructor(schedule: Scheduler) {
    this.schedule = schedule;
  }

  getState(): ClientState {
    return this.state;
  }

  lastSeq(): number {
    return this.seq;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  applySnapshot(snapshot: Snapshot, seq: number): void {
    this.queue = [];
    this.seq = seq;
    this.set(fromSnapshot(snapshot, this.state.link));
  }

  applyEvents(events: StreamEvent[]): void {
    const fresh = events.filter((e) => e.seq > this.seq);
    const last = fresh.at(-1);
    if (last === undefined) return;
    this.seq = last.seq;
    this.queue.push(...fresh);
    if (this.scheduled) return;
    this.scheduled = true;
    this.schedule(() => {
      this.flush();
    });
  }

  setLink(link: LinkState): void {
    this.set({ ...this.state, link });
  }

  private flush(): void {
    this.scheduled = false;
    const batch = this.queue;
    this.queue = [];
    this.set(batch.reduce(applyEvent, this.state));
  }

  private set(next: ClientState): void {
    this.state = next;
    for (const cb of this.listeners) cb();
  }
}
