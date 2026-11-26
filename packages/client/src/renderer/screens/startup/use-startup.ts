import { useCallback, useEffect, useState } from "react";
import type { RepoView } from "../../../../../protocol/src/index.ts";
import { useBridge, useCraft } from "../../state/index.ts";
import { clampIndex, startupAction } from "./startup-keys.ts";

export interface StartupModel {
  repos: readonly RepoView[];
  selected: number;
  error: string | undefined;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA"]);

/** Startup screen behaviour: the repo list, the highlight and the keys. */
export function useStartup(): StartupModel {
  const repos = useCraft((s) => s.repos);
  const bridge = useBridge();
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);

  const open = useCallback(
    async (path: string): Promise<void> => {
      const reply = await bridge.send({ name: "repo.open", args: { path } });
      setError(reply.ok ? undefined : reply.error.message);
    },
    [bridge],
  );

  const openFolder = useCallback(async (): Promise<void> => {
    const path = await bridge.pickFolder();
    if (path !== undefined) await open(path);
  }, [bridge, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.target instanceof HTMLElement && TYPING_TAGS.has(e.target.tagName)) return;
      const action = startupAction(e.key, selected, repos);
      if (action.type === "move") setSelected(clampIndex(selected, action.delta, repos.length));
      if (action.type === "open-folder") void openFolder();
      const repo = action.type === "pick" ? repos[action.index] : undefined;
      if (repo !== undefined) void open(repo.path);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [selected, repos, open, openFolder]);

  return { repos, selected, error };
}
