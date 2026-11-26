import type { AnyCommandHandler, SessionKey } from "@craft/protocol";
import type { Disposable } from "../bus/index.ts";
import type { Phase } from "../domain/index.ts";

export type { Phase };

export interface ToolCall {
  sid: SessionKey;
  toolUseId: string;
  tool: string;
  input: unknown;
  paths: string[];
  agentId?: string;
}

export type Final = { kind: "allow" } | { kind: "deny"; reason: string };
export type Verdict = Final | { kind: "hold"; reason: string; until: Promise<Final> };

export interface Interceptor {
  id: string;
  /** 'core' or a graft name. */
  owner: string;
  phase: Phase;
  decide(call: ToolCall, signal: AbortSignal): Promise<Verdict>;
}

export interface ToolGate {
  check(
    call: ToolCall,
    signal: AbortSignal,
  ): Promise<{ kind: "pass" } | { kind: "deny"; reason: string }>;
}

export interface ApprovalGate {
  ask(call: ToolCall, signal: AbortSignal): Promise<Final>;
}

/** Placeholder until the interception task. Fails closed: it denies every call. */
export class InterceptionChain implements ToolGate {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub keeps the final signature
  register(interceptor: Interceptor): Disposable {
    return { dispose: () => undefined };
  }

  check(): Promise<{ kind: "deny"; reason: string }> {
    return Promise.resolve({ kind: "deny", reason: "interception chain not built yet" });
  }
}

export function commands(): AnyCommandHandler[] {
  return [];
}
