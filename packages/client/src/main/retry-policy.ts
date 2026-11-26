import {
  BACKOFF_MAX_MS,
  BACKOFF_START_MS,
  IMPOSTOR_STRIKES,
  RELAUNCH_AFTER_MS,
} from "./constants.ts";

export interface RetryAdvice {
  waitMs: number;
  /** Connecting has failed for long enough that the worker should be started again. */
  relaunch: boolean;
  /** The pipe answers, but not with this machine's token, several times in a row. */
  nameTaken: boolean;
}

/** Backoff 250 ms to 5 s, relaunch after 10 s of failures (LLD 2.2). Pure. */
export class RetryPolicy {
  private waitMs = BACKOFF_START_MS;
  private failingMs = 0;
  private strikes = 0;

  onConnected(): void {
    this.waitMs = BACKOFF_START_MS;
    this.failingMs = 0;
    this.strikes = 0;
  }

  onFailure(impostor: boolean): RetryAdvice {
    const waitMs = this.waitMs;
    this.failingMs += waitMs;
    this.strikes = impostor ? this.strikes + 1 : 0;
    this.waitMs = Math.min(waitMs * 2, BACKOFF_MAX_MS);
    const relaunch = this.failingMs >= RELAUNCH_AFTER_MS;
    if (relaunch) this.failingMs = 0;
    return { waitMs, relaunch, nameTaken: this.strikes >= IMPOSTOR_STRIKES };
  }
}
