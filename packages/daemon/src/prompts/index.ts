import { CraftError, type AnyCommandHandler } from "@craft/protocol";
import { FifoPromptQueue } from "./queue.ts";
import type { PromptQueue, PromptQueueDeps } from "./types.ts";

export type { OpenPrompt } from "@craft/protocol";
export type { PromptAnswerResult, PromptQueue, PromptQueueDeps, PromptSpec } from "./types.ts";

export function createPromptQueue(deps: PromptQueueDeps): PromptQueue {
  return new FifoPromptQueue(deps);
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
