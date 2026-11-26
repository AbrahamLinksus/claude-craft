import {
  latestWinsKey,
  type Criticality,
  type SessionKey,
  type StreamEvent,
} from "../../../protocol/src/index.ts";

export interface Disposable {
  dispose(): void;
}

export interface EventFilter {
  types?: string[];
  sid?: SessionKey;
}

export type EventHandler = (e: StreamEvent) => void | Promise<void>;

export interface SubscribeOptions {
  name: string;
  capacity?: number;
}

export interface SubscriberHooks {
  /** A handler threw; the bus keeps going. */
  onError(name: string, error: unknown): void;
  /** The queue grew past the lag limit (reported once until it drains). */
  onLag(name: string, queued: number): void;
}

export const DEFAULT_CAPACITY = 1000;
export const LAG_LIMIT = 5000;

interface Queued {
  event: StreamEvent;
  crit: Criticality;
}

/**
 * One subscriber: a bounded FIFO drained in order. Sync handlers run inside `publish`;
 * an async handler is awaited before the next event is handed over.
 */
export class Subscriber {
  readonly name: string;
  private readonly filter: EventFilter;
  private readonly handler: EventHandler;
  private readonly hooks: SubscriberHooks;
  private readonly queue: Queued[] = [];
  private readonly capacity: number;
  private draining = false;
  private lagReported = false;

  constructor(
    filter: EventFilter,
    handler: EventHandler,
    opts: SubscribeOptions,
    hooks: SubscriberHooks,
  ) {
    this.filter = filter;
    this.handler = handler;
    this.hooks = hooks;
    this.name = opts.name;
    this.capacity = opts.capacity ?? DEFAULT_CAPACITY;
  }

  matches(e: StreamEvent): boolean {
    if (this.filter.sid !== undefined && e.sid !== this.filter.sid) return false;
    return this.filter.types === undefined || this.filter.types.includes(e.type);
  }

  queued(): number {
    return this.queue.length;
  }

  /** Resolves when everything queued so far has been handled. */
  idle(): Promise<void> {
    return new Promise((resolve) => {
      const check = (): void => {
        if (this.draining || this.queue.length > 0) setImmediate(check);
        else resolve();
      };
      check();
    });
  }

  enqueue(event: StreamEvent, crit: Criticality): void {
    if (crit === "latest-wins") this.collapse(event);
    if (crit !== "critical" && this.queue.length >= this.capacity && !this.makeRoom()) return;
    this.queue.push({ event, crit });
    this.checkLag();
    this.drain();
  }

  /** Replace the queued event with the same key: only the newest value matters. */
  private collapse(event: StreamEvent): void {
    const key = latestWinsKey(event);
    const at = this.queue.findIndex(
      (q) => q.crit === "latest-wins" && latestWinsKey(q.event) === key,
    );
    if (at >= 0) this.queue.splice(at, 1);
  }

  /** Drop the oldest droppable entry; false when nothing may be dropped. */
  private makeRoom(): boolean {
    const at = this.queue.findIndex((q) => q.crit === "droppable");
    if (at < 0) return false;
    this.queue.splice(at, 1);
    return true;
  }

  private checkLag(): void {
    if (this.queue.length > LAG_LIMIT && !this.lagReported) {
      this.lagReported = true;
      this.hooks.onLag(this.name, this.queue.length);
    } else if (this.queue.length === 0) {
      this.lagReported = false;
    }
  }

  private drain(): void {
    if (this.draining) return;
    this.draining = true;
    this.step();
  }

  /** Hand over queued events in order; an async handler pauses the loop until it settles. */
  private step(): void {
    for (;;) {
      const next = this.queue.shift();
      if (next === undefined) {
        this.draining = false;
        this.checkLag();
        return;
      }
      const result = this.run(next.event);
      if (result !== undefined) {
        void result.then(() => {
          this.step();
        });
        return;
      }
    }
  }

  /** Run the handler; returns a promise only when the handler is async. */
  private run(event: StreamEvent): Promise<void> | undefined {
    try {
      const result = this.handler(event);
      if (result instanceof Promise) {
        return result.catch((error: unknown) => {
          this.hooks.onError(this.name, error);
        });
      }
    } catch (error) {
      this.hooks.onError(this.name, error);
    }
    return undefined;
  }
}
