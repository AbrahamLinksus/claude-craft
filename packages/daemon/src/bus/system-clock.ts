import type { Clock } from "../domain/index.ts";

/** The real clock; the only place core timers are created. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  after(ms: number, fn: () => void): () => void {
    const handle = setTimeout(fn, ms);
    return () => {
      clearTimeout(handle);
    };
  }

  every(ms: number, fn: () => void): () => void {
    const handle = setInterval(fn, ms);
    return () => {
      clearInterval(handle);
    };
  }
}
