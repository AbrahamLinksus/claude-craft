import { sessionKey, type RepoId, type SessionKey } from "@craft/protocol";

/** Session numbers per repo count up from 1 and are never reused (LLD 7.3). */
export interface Numbering {
  n: number;
  nextN: number;
}

export function allocateNumber(nextN: number): Numbering {
  const n = Math.max(1, Math.floor(nextN));
  return { n, nextN: n + 1 };
}

export function sessionKeyFor(repoId: RepoId, n: number): SessionKey {
  return sessionKey(repoId, n);
}

/** Branch name of session `n` (LLD 15.1). */
export function branchFor(n: number): string {
  return `craft/s${String(n)}`;
}

/** The first free number given every number already seen (used when `nextN` is lost). */
export function nextAfter(seen: readonly number[]): number {
  return seen.reduce((max, n) => Math.max(max, n), 0) + 1;
}
