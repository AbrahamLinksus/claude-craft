import type { OpenPrompt, SessionView } from "@craft/protocol";
import { useCraft } from "../state/index.ts";
import { readUsage, sessionCounts, sessionLabel, type UsageView } from "./model.ts";

export interface ShellModel {
  sessions: SessionView[];
  focused: SessionView | undefined;
  repo: string | undefined;
  usage: UsageView;
  counts: string;
  prompt: OpenPrompt | undefined;
  promptSession: string | undefined;
}

/** Everything the shell draws, read from the store (LLD 13.2). */
export function useShellModel(focusedSid: string | undefined): ShellModel {
  const sessions = useCraft((s) => s.sessions);
  const repos = useCraft((s) => s.repos);
  const usage = useCraft((s) => s.usage);
  const prompt = useCraft((s) => s.prompt.head);
  const focused = sessions.find((s) => s.sid === focusedSid) ?? sessions[0];
  const owner = sessions.find((s) => s.sid === prompt?.sid);
  return {
    sessions,
    focused,
    repo: repos.find((r) => r.repoId === focused?.repoId)?.name,
    usage: readUsage(usage),
    counts: sessionCounts(sessions),
    prompt,
    promptSession: owner === undefined ? undefined : sessionLabel(owner),
  };
}
