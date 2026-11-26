/** Injected so core logic never reads the system clock or schedules timers directly. */
export interface Clock {
  now(): Date;
  /** Run `fn` once after `ms`; call the returned function to cancel. */
  after(ms: number, fn: () => void): () => void;
  /** Run `fn` every `ms`; call the returned function to stop. */
  every(ms: number, fn: () => void): () => void;
}
