import type { RepoView } from "@craft/protocol";

export type StartupAction =
  | { type: "move"; delta: number }
  | { type: "pick"; index: number }
  | { type: "open-folder" }
  | { type: "none" };

const DIGIT = /^[1-9]$/;

/** Keys of the Startup screen: j/k move, enter or a number picks, o opens a folder (US-01). */
export function startupAction(
  key: string,
  selected: number,
  repos: readonly RepoView[],
): StartupAction {
  if (key === "j") return { type: "move", delta: 1 };
  if (key === "k") return { type: "move", delta: -1 };
  if (key === "o") return { type: "open-folder" };
  if (key === "Enter") {
    return repos.length === 0 ? { type: "none" } : { type: "pick", index: selected };
  }
  if (DIGIT.test(key) && Number(key) <= repos.length) {
    return { type: "pick", index: Number(key) - 1 };
  }
  return { type: "none" };
}

/** Move the highlight, staying inside the list. */
export function clampIndex(index: number, delta: number, count: number): number {
  return count === 0 ? 0 : Math.min(count - 1, Math.max(0, index + delta));
}
