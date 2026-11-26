import type { Clock } from "../../src/domain/index.ts";

interface Timer {
  at: number;
  fn: () => void;
  every: number | undefined;
}

/** A clock that only moves when the test says so. */
export class ManualClock implements Clock {
  private time = Date.UTC(2026, 0, 1);
  private readonly timers = new Set<Timer>();

  now(): Date {
    return new Date(this.time);
  }

  after(ms: number, fn: () => void): () => void {
    return this.add({ at: this.time + ms, fn, every: undefined });
  }

  every(ms: number, fn: () => void): () => void {
    return this.add({ at: this.time + ms, fn, every: ms });
  }

  /** Number of timers waiting. */
  pending(): number {
    return this.timers.size;
  }

  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = [...this.timers].filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (due === undefined) break;
      this.time = due.at;
      if (due.every === undefined) this.timers.delete(due);
      else due.at += due.every;
      due.fn();
    }
    this.time = target;
  }

  private add(timer: Timer): () => void {
    this.timers.add(timer);
    return () => {
      this.timers.delete(timer);
    };
  }
}
