import type { SessionStateName } from "../../../protocol/src/index.ts";

export type Pool = "own" | "team";

const LIVE: ReadonlySet<SessionStateName> = new Set([
  "starting",
  "running",
  "idle",
  "retrying",
  "paused",
]);

/** Live = a state that takes a slot (LLD 7.3). */
export function isLive(state: SessionStateName): boolean {
  return LIVE.has(state);
}

export interface PoolCaps {
  cap: number;
  teamCap: number;
}

export interface CapCheck {
  pool: Pool;
  limit: number;
  live: number;
  free: number;
}

/** Count live sessions per pool against `sessions.cap` / `sessions.teamCap`, counted separately. */
export function checkCap(
  sessions: readonly { state: SessionStateName; pool: Pool }[],
  pool: Pool,
  caps: PoolCaps,
): CapCheck {
  const live = sessions.filter((s) => s.pool === pool && isLive(s.state)).length;
  const limit = pool === "own" ? caps.cap : caps.teamCap;
  return { pool, limit, live, free: Math.max(0, limit - live) };
}

export type StartPlan =
  | { kind: "all"; start: number }
  | { kind: "partial"; start: number; asked: number }
  | { kind: "none" };

/** `count` wanted: all fit, only some fit ("Only 2 fit: start 2?", G-6), or none (CAP_REACHED). */
export function planStart(count: number, free: number): StartPlan {
  if (free <= 0) return { kind: "none" };
  if (count <= free) return { kind: "all", start: count };
  return { kind: "partial", start: free, asked: count };
}
