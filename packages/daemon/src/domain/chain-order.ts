/** Interceptor phases in their fixed order (LLD 8.1). */
export const PHASES = ["guard", "pause", "collision", "budget", "policy"] as const;
export type Phase = (typeof PHASES)[number];

export function phaseRank(phase: Phase): number {
  return PHASES.indexOf(phase);
}

/** Phase order first, then registration order (the input order); never mutates the input. */
export function orderInterceptors<T extends { phase: Phase }>(registered: readonly T[]): T[] {
  return registered
    .map((item, index) => ({ item, index }))
    .sort((a, b) => phaseRank(a.item.phase) - phaseRank(b.item.phase) || a.index - b.index)
    .map((entry) => entry.item);
}
