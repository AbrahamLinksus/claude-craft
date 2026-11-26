import { homedir } from "node:os";
import { join } from "node:path";

/** Every path under `CRAFT_HOME` (LLD 5.1), built once from the home folder. */
export interface CraftPaths {
  home: string;
  configDir: string;
  stateDir: string;
  logsDir: string;
  settings: string;
  grafts: string;
  repoSettings: string;
  credentials: string;
  token: string;
  daemonInfo: string;
  repos: string;
  undo: string;
  children: string;
  promptsDir: string;
  sessionRecord(repoId: string, n: number): string;
  graftDataDir(graft: string): string;
  usageHistory(yearMonth: string): string;
}

/** `CRAFT_HOME` or `%USERPROFILE%\.craft`. */
export function resolveHome(env: Readonly<Record<string, string | undefined>>): string {
  const override = env["CRAFT_HOME"];
  return override !== undefined && override !== "" ? override : join(homedir(), ".craft");
}

export function craftPaths(home: string): CraftPaths {
  const config = join(home, "config");
  const state = join(home, "state");
  return {
    home,
    configDir: config,
    stateDir: state,
    logsDir: join(home, "logs"),
    settings: join(config, "settings.json"),
    grafts: join(config, "grafts.json"),
    repoSettings: join(config, "repos.json"),
    credentials: join(home, "credentials.json"),
    token: join(home, "daemon.token"),
    daemonInfo: join(home, "daemon.json"),
    repos: join(state, "repos.json"),
    undo: join(state, "undo.json"),
    children: join(state, "children.json"),
    promptsDir: join(home, "prompts"),
    sessionRecord: (repoId, n) => join(state, "sessions", repoId, `s${String(n)}.json`),
    graftDataDir: (graft) => join(home, "graft-data", graft),
    usageHistory: (yearMonth) => join(home, "usage", `history-${yearMonth}.jsonl`),
  };
}
