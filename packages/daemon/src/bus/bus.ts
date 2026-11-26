import {
  criticalityOf,
  type EventInput,
  type GraftCriticality,
  type StreamEvent,
} from "@craft/protocol";
import type { Clock } from "../domain/index.ts";
import {
  Subscriber,
  type Disposable,
  type EventFilter,
  type EventHandler,
  type SubscribeOptions,
  type SubscriberHooks,
} from "./subscriber.ts";

export interface Bus {
  /** Assigns `seq` and `ts`, then queues the event for every matching subscriber. */
  publish(e: EventInput): StreamEvent;
  subscribe(filter: EventFilter, handler: EventHandler, opts?: SubscribeOptions): Disposable;
  /** Highest `seq` published so far (0 before the first event). */
  lastSeq(): number;
}

export interface BusOptions {
  clock: Clock;
  hooks: SubscriberHooks;
  /** Criticality of graft event types, from the graft manifests (default critical). */
  graftCriticality?: GraftCriticality;
}

let anonymous = 0;

export class InMemoryBus implements Bus {
  private seq = 0;
  private readonly subscribers = new Set<Subscriber>();
  private readonly opts: BusOptions;

  constructor(opts: BusOptions) {
    this.opts = opts;
  }

  publish(input: EventInput): StreamEvent {
    this.seq += 1;
    const event: StreamEvent = {
      seq: this.seq,
      ts: this.opts.clock.now().toISOString(),
      type: input.type,
      data: input.data,
      ...(input.sid === undefined ? {} : { sid: input.sid }),
    };
    const crit = criticalityOf(event, this.opts.graftCriticality);
    for (const sub of [...this.subscribers]) {
      if (sub.matches(event)) sub.enqueue(event, crit);
    }
    return event;
  }

  subscribe(filter: EventFilter, handler: EventHandler, opts?: SubscribeOptions): Disposable {
    anonymous += 1;
    const name = opts?.name ?? `subscriber-${String(anonymous)}`;
    const sub = new Subscriber(filter, handler, { ...opts, name }, this.opts.hooks);
    this.subscribers.add(sub);
    return {
      dispose: () => {
        this.subscribers.delete(sub);
      },
    };
  }

  lastSeq(): number {
    return this.seq;
  }

  /** Resolves when every subscriber has handled what was published so far (tests, shutdown). */
  async idle(): Promise<void> {
    await Promise.all([...this.subscribers].map((s) => s.idle()));
  }
}
