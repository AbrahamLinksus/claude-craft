import { CraftError, sessionLabel, type OpenPrompt } from "@craft/protocol";
import type { Bus } from "../bus/index.ts";
import type { PromptAnswerResult, PromptQueue, PromptQueueDeps, PromptSpec } from "./types.ts";

interface Waiting {
  id: string;
  spec: PromptSpec;
  resolve: (key: string) => void;
  reject: (error: Error) => void;
}

/** "s2 wants to edit …": the session comes first when the prompt belongs to one. */
function titled(spec: PromptSpec): string {
  if (spec.sid === undefined) return spec.title;
  const label = sessionLabel(spec.sid);
  return spec.title.startsWith(label) ? spec.title : `${label} ${spec.title}`;
}

/** One FIFO of modal prompts; only the head is on screen and only it can be answered. */
export class FifoPromptQueue implements PromptQueue {
  private readonly queue: Waiting[] = [];
  private readonly bus: Bus;
  private nextId = 1;
  /** Prompts finished since the queue was last empty, so "2 of 3" keeps its total. */
  private served = 0;

  constructor(deps: PromptQueueDeps) {
    this.bus = deps.bus;
  }

  ask(spec: PromptSpec, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted === true) return Promise.reject(new CraftError("PROMPT_CANCELLED"));
    return new Promise<string>((resolve, reject) => {
      const waiting: Waiting = { id: `p${String(this.nextId++)}`, spec, resolve, reject };
      if (spec.front === true) this.queue.unshift(waiting);
      else this.queue.push(waiting);
      signal?.addEventListener("abort", () => {
        this.cancel(waiting);
      });
      this.changed();
    });
  }

  answer(id: string, key: string): PromptAnswerResult {
    const head = this.queue[0];
    if (head?.id !== id) return { ok: false, code: "NOT_ON_SCREEN" };
    if (!head.spec.options.some((o) => o.key === key)) return { ok: false, code: "INVALID_KEY" };
    this.remove(head);
    head.resolve(key);
    this.changed();
    return { ok: true };
  }

  head(): OpenPrompt | undefined {
    const head = this.queue[0];
    if (head === undefined) return undefined;
    return {
      ...head.spec,
      title: titled(head.spec),
      id: head.id,
      position: this.served + 1,
      total: this.served + this.queue.length,
    };
  }

  count(): number {
    return this.queue.length;
  }

  private cancel(waiting: Waiting): void {
    if (!this.queue.includes(waiting)) return;
    this.remove(waiting);
    waiting.reject(new CraftError("PROMPT_CANCELLED"));
    this.changed();
  }

  /** Taking the head off counts it as served; a waiting prompt just leaves. */
  private remove(waiting: Waiting): void {
    const at = this.queue.indexOf(waiting);
    if (at === 0) this.served += 1;
    this.queue.splice(at, 1);
    if (this.queue.length === 0) this.served = 0;
  }

  private changed(): void {
    const head = this.head();
    this.bus.publish({
      type: "PromptQueueChanged",
      data: head === undefined ? { count: this.count() } : { head, count: this.count() },
    });
  }
}
