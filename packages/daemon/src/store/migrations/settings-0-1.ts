import type { Migration } from "./registry.ts";

/** v0 kept every setting at the top level under flat names (no `schema` field). */
const FLAT_TO_NESTED: readonly (readonly [string, readonly string[]])[] = [
  ["signInMethod", ["signIn", "method"]],
  ["sessionCap", ["sessions", "cap"]],
  ["teamCap", ["sessions", "teamCap"]],
  ["offlineRetryMinutes", ["sessions", "offlineRetryMinutes"]],
  ["defaultModel", ["sessions", "defaultModel"]],
  ["permissionMode", ["agent", "permissionMode"]],
  ["settingSources", ["agent", "settingSources"]],
  ["usageThresholds", ["usage", "thresholds"]],
  ["usageStaleMinutes", ["usage", "staleMinutes"]],
  ["raceReview", ["race", "review"]],
  ["fleetLayout", ["ui", "fleetLayout"]],
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function put(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  const [head, ...rest] = path;
  if (head === undefined) return;
  if (rest.length === 0) {
    target[head] = value;
    return;
  }
  const child = isRecord(target[head]) ? target[head] : {};
  target[head] = child;
  put(child, rest, value);
}

export const migration: Migration = {
  from: 0,
  to: 1,
  migrate(old) {
    if (!isRecord(old)) return old;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(old)) {
      if (!FLAT_TO_NESTED.some(([flat]) => flat === key)) next[key] = value;
    }
    for (const [flat, path] of FLAT_TO_NESTED) {
      if (flat in old) put(next, path, old[flat]);
    }
    return next;
  },
};
