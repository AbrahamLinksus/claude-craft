import {
  STREAM_FLUSH_MS,
  STREAM_RING_SIZE,
  criticalityOf,
  type DaemonMessage,
  type GraftCriticality,
  type StreamEvent,
} from "../../../protocol/src/index.ts";
import type { Bus, Disposable } from "../bus/index.ts";
import type { Clock } from "../domain/index.ts";
import { EventBatch } from "./event-batch.ts";

/** Above this many buffered socket bytes, non-critical events are dropped (LLD 2.3). */
export const MAX_SOCKET_BACKLOG_BYTES = 8 * 1024 * 1024;
/** Keep each `events` line well under the 1 MB line limit. */
const MAX_CHUNK_BYTES = 512 * 1024;

export interface FeedOptions {
  bus: Bus;
  clock: Clock;
  send(msg: DaemonMessage): void;
  /** Bytes the socket still has to flush. */
  backlog(): number;
  graftCriticality?: GraftCriticality | undefined;
}

/** One connection's live stream: batches events every 33 ms, coalesces, sheds load. */
export class StreamFeed {
  private readonly opts: FeedOptions;
  private readonly batch = new EventBatch();
  private subscription: Disposable | undefined;
  private cancelTimer: (() => void) | undefined;

  constructor(opts: FeedOptions) {
    this.opts = opts;
  }

  /** Deliver every event after `afterSeq`; `since` is the snapshot or catch-up point. */
  start(afterSeq: number, name: string): void {
    this.subscription = this.opts.bus.subscribe(
      {},
      (e) => {
        if (e.seq > afterSeq) this.add(e);
      },
      { name },
    );
  }

  stop(): void {
    this.subscription?.dispose();
    this.subscription = undefined;
    this.cancelTimer?.();
    this.cancelTimer = undefined;
  }

  private add(e: StreamEvent): void {
    const crit = criticalityOf(e, this.opts.graftCriticality);
    if (crit !== "critical" && this.opts.backlog() > MAX_SOCKET_BACKLOG_BYTES) return;
    this.batch.push(e, crit);
    if (this.batch.size() > STREAM_RING_SIZE) {
      this.batch.drain();
      this.opts.send({ type: "resync" });
      return;
    }
    this.cancelTimer ??= this.opts.clock.after(STREAM_FLUSH_MS, () => {
      this.flush();
    });
  }

  private flush(): void {
    this.cancelTimer = undefined;
    for (const items of chunk(this.batch.drain())) this.opts.send({ type: "events", items });
  }
}

function chunk(events: StreamEvent[]): StreamEvent[][] {
  const out: StreamEvent[][] = [];
  let current: StreamEvent[] = [];
  let bytes = 0;
  for (const e of events) {
    const size = JSON.stringify(e).length;
    if (current.length > 0 && bytes + size > MAX_CHUNK_BYTES) {
      out.push(current);
      current = [];
      bytes = 0;
    }
    current.push(e);
    bytes += size;
  }
  if (current.length > 0) out.push(current);
  return out;
}
