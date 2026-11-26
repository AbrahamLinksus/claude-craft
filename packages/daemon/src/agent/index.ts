import type {
  AnyCommandHandler,
  EventInput,
  CoreEvent,
  PermissionModeSetting,
  SessionKey,
} from "../../../protocol/src/index.ts";
import { notBuilt } from "../domain/index.ts";
import type { ApprovalGate, ToolGate } from "../intercept/index.ts";

export type ModelId = string;

export interface Tokens {
  in: number;
  out: number;
  cacheRead: number;
  cacheWrite: number;
}

/** A core event as the adapter emits it: no `seq` or `ts` yet. */
export type AgentEvent = EventInput<CoreEvent>;

export interface StartRequest {
  sid: SessionKey;
  cwd: string;
  model: ModelId;
  resume?: { sdkSessionId: string };
  env: Readonly<Record<string, string>>;
  permissionMode: PermissionModeSetting;
  settingSources: string[];
  gate: ToolGate;
  approvals: ApprovalGate;
}

export interface AgentSession {
  /** Queues a user message into the streaming-input iterable. */
  send(text: string): void;
  interrupt(): Promise<void>;
  /** Abort controller + query.close(). */
  close(): Promise<void>;
  readonly events: AsyncIterable<AgentEvent>;
  readonly sdkSessionId: Promise<string>;
}

export interface AgentPort {
  start(req: StartRequest): AgentSession;
  fork(req: { sdkSessionId: string; upToMessageId: string }): Promise<{ sdkSessionId: string }>;
  review(req: {
    cwd: string;
    prompt: string;
    model: ModelId;
    signal: AbortSignal;
  }): Promise<{ score: number; reason: string; tokens: Tokens }>;
}

/** Placeholder until the agent task; the only SDK import will live in `sdk-adapter/`. */
export function createAgentPort(): AgentPort {
  return notBuilt<AgentPort>("agent");
}

export function commands(): AnyCommandHandler[] {
  return [];
}
