import { STREAM_RING_SIZE, type StreamEvent } from "../../../protocol/src/index.ts";

/** The last N events, so a reconnecting client can catch up without a full snapshot. */
export class StreamRing {
  private events: StreamEvent[] = [];
  private readonly size: number;

  constructor(size: number = STREAM_RING_SIZE) {
    this.size = size;
  }

  push(e: StreamEvent): void {
    this.events.push(e);
    if (this.events.length > this.size * 2) this.events = this.events.slice(-this.size);
  }

  lastSeq(): number {
    return this.events[this.events.length - 1]?.seq ?? 0;
  }

  /** Events after `seq`, or 'gone' when the ring no longer reaches back that far. */
  since(seq: number): StreamEvent[] | "gone" {
    const window = this.events.slice(-this.size);
    const first = window[0];
    if (first === undefined) return seq === 0 ? [] : "gone";
    if (seq + 1 < first.seq) return "gone";
    return window.filter((e) => e.seq > seq);
  }
}
