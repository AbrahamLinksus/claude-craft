import type { AnyCommandHandler, RepoId, RepoView, SessionKey, SessionView } from "@craft/protocol";
import type { AgentPort, ModelId } from "../agent/index.ts";
import type { AuthService } from "../auth/index.ts";
import type { Bus } from "../bus/index.ts";
import { notBuilt, type Clock, type Pool } from "../domain/index.ts";
import type { EventLog } from "../eventlog/index.ts";
import type { GitRead } from "../git/index.ts";
import type { Logger } from "../log/index.ts";
import type { PromptQueue } from "../prompts/index.ts";
import type { SettingsService, Store, StoreFiles } from "../store/index.ts";

export type { Pool };

/** Provided by the worktrees graft (LLD 15.1); the host asks the graft host for it. */
export interface WorkspacePort {
  create(req: {
    repoId: RepoId;
    repoPath: string;
    n: number;
    fromSha?: string;
  }): Promise<{ path: string; branch: string; baseSha: string; uncommittedInMain: string[] }>;
  commitTurn(req: { sid: SessionKey; turn: number; title: string }): Promise<string | null>;
  /** Only after an owner's confirm. */
  remove(req: { sid: SessionKey }): Promise<void>;
}

export interface SessionHost {
  /** NOT_A_GIT_REPO, NO_COMMITS. */
  openRepo(path: string): Promise<RepoView>;
  forgetRepo(repoKey: string): Promise<void>;
  /** Recent repos for the Startup screen (state/repos.json). */
  repos(): RepoView[];
  create(req: {
    repoId: RepoId;
    prompt: string;
    model?: ModelId | undefined;
    pool?: Pool;
  }): Promise<SessionKey>;
  fork(req: {
    from: SessionKey;
    atTurn?: number;
    count: number;
    pool?: Pool;
    prompt?: string;
  }): Promise<SessionKey[]>;
  prompt(sid: SessionKey, text: string, origin?: string): void;
  /** To cryo 'stopped'. */
  stop(sid: SessionKey): Promise<void>;
  resume(sid: SessionKey): Promise<void>;
  /** G-14: holds every tool call via the pause gate. */
  pause(sid: SessionKey, by: string): Promise<void>;
  unpause(sid: SessionKey, by: string): Promise<void>;
  toGraveyard(sid: SessionKey): Promise<void>;
  fromGraveyard(sid: SessionKey): Promise<void>;
  whenTurnEnds(sid: SessionKey): Promise<void>;
  list(filter?: { repoId?: RepoId; pool?: Pool }): SessionView[];
  /** Crash recovery at daemon start (LLD 7.3): live sessions become cryo; returns their keys. */
  recover(): Promise<SessionKey[]>;
}

export interface SessionHostDeps {
  bus: Bus;
  clock: Clock;
  log: Logger;
  store: Store;
  files: StoreFiles;
  settings: SettingsService;
  agent: AgentPort;
  auth: AuthService;
  eventLog: EventLog;
  prompts: PromptQueue;
  git: GitRead;
  workspace: () => WorkspacePort | undefined;
}

/** Placeholder until the session-host task: no repos, no sessions. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub keeps the final signature
export function createSessionHost(deps: SessionHostDeps): SessionHost {
  return notBuilt<SessionHost>("sessions", {
    repos: () => [],
    list: () => [],
    recover: () => Promise.resolve([]),
  });
}

export function commands(host: SessionHost): AnyCommandHandler[] {
  return [
    { name: "repo.list", run: () => Promise.resolve(host.repos()) },
    { name: "repo.open", run: (args) => host.openRepo(args.path) },
    { name: "repo.forget", run: (args) => host.forgetRepo(args.repoKey) },
    {
      name: "session.create",
      run: async (args) => ({
        sid: await host.create({ repoId: args.repoId, prompt: args.prompt, model: args.model }),
      }),
    },
    {
      name: "session.prompt",
      run: (args) => {
        host.prompt(args.sid, args.text, "owner");
        return Promise.resolve({});
      },
    },
  ];
}
