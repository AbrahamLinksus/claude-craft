import {
  CraftError,
  type AnyCommandHandler,
  type ErrorCode,
  type OpenPrompt,
  type SessionKey,
} from "../../../protocol/src/index.ts";
import type { Bus } from "../bus/index.ts";
import { notBuilt } from "../domain/index.ts";

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

/** Placeholder until the prompt-queue task: empty queue, `ask` and `answer` throw. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub keeps the final signature
export function createPromptQueue(deps: PromptQueueDeps): PromptQueue {
  return notBuilt<PromptQueue>("prompts", { head: () => undefined, count: () => 0 });
}

export function commands(queue: PromptQueue): AnyCommandHandler[] {
  return [
    {
      name: "prompt.answer",
      run: (args) => {
        const result = queue.answer(args.promptId, args.key);
        if (!result.ok) throw new CraftError(result.code);
        return Promise.resolve({});
      },
    },
  ];
}
