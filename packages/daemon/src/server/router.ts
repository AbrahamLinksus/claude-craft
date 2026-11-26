import {
  COMMAND_ARGS,
  CraftError,
  isCraftError,
  type AnyCommandHandler,
  type CmdCtx,
  type CommandArgs,
  type CommandHandler,
  type CommandName,
} from "../../../protocol/src/index.ts";
import type { Logger } from "../log/index.ts";

export type RouteResult =
  { ok: true; data: unknown } | { ok: false; error: { code: CraftError["code"]; message: string } };

/** Validates `cmd` args with zod, runs the registered handler, turns errors into replies. */
export class CommandRouter {
  private readonly handlers = new Map<CommandName, AnyCommandHandler>();
  private readonly log: Logger;

  constructor(log: Logger) {
    this.log = log;
  }

  register(...handlers: readonly AnyCommandHandler[]): void {
    for (const handler of handlers) {
      if (this.handlers.has(handler.name)) {
        throw new Error(`command ${handler.name} is registered twice`);
      }
      this.handlers.set(handler.name, handler);
    }
  }

  names(): CommandName[] {
    return [...this.handlers.keys()];
  }

  async dispatch(name: CommandName, args: unknown, ctx: CmdCtx): Promise<RouteResult> {
    try {
      const handler = this.handlers.get(name);
      if (handler === undefined)
        throw new CraftError("INTERNAL", {}, { command: name, why: "not built" });
      return { ok: true, data: await runHandler(handler, args, ctx) };
    } catch (error) {
      return this.failure(name, error);
    }
  }

  private failure(name: CommandName, error: unknown): RouteResult {
    if (isCraftError(error)) {
      return { ok: false, error: { code: error.code, message: error.userMessage } };
    }
    this.log.error("command failed", {
      command: name,
      error: error instanceof Error ? error.message : "unknown",
    });
    const internal = new CraftError("INTERNAL");
    return { ok: false, error: { code: internal.code, message: internal.userMessage } };
  }
}

async function runHandler<N extends CommandName>(
  handler: CommandHandler<N>,
  args: unknown,
  ctx: CmdCtx,
): Promise<unknown> {
  const parsed = COMMAND_ARGS[handler.name].safeParse(args ?? {});
  if (!parsed.success) throw new CraftError("PROTOCOL_ERROR", {}, { command: handler.name });
  return handler.run(parsed.data as CommandArgs<N>, ctx);
}
