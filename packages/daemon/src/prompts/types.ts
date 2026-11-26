import type { ErrorCode, OpenPrompt, SessionKey } from "@craft/protocol";
import type { Bus } from "../bus/index.ts";

export type { OpenPrompt };

export interface PromptSpec {
  kind: "hold" | "approval" | "confirm" | "choice";
  sid?: SessionKey;
  source: string;
  title: string;
  body?: string[];
  options: { key: string; label: string }[];
  front?: boolean;
}

export type PromptAnswerResult = { ok: true } | { ok: false; code: ErrorCode };

export interface PromptQueue {
  /** Resolves with the chosen key; rejects PROMPT_CANCELLED. */
  ask(spec: PromptSpec, signal?: AbortSignal): Promise<string>;
  /** NOT_ON_SCREEN if id is not the head; INVALID_KEY keeps it open. */
  answer(id: string, key: string): PromptAnswerResult;
  head(): OpenPrompt | undefined;
  count(): number;
}

export interface PromptQueueDeps {
  bus: Bus;
}
