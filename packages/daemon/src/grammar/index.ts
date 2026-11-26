import { CraftError, type AnyCommandHandler } from "@craft/protocol";
import { DefaultGrammarRegistry } from "./registry.ts";
import type { GrammarRegistry, RunResult } from "./types.ts";

export type { ObjectDef, Sentence, VerbDef } from "./types.ts";
export type {
  Binding,
  CommandDef,
  GrammarDef,
  GrammarRegistry,
  PanelKeys,
  RunCtx,
  RunResult,
} from "./types.ts";

/** The registry, seeded with the core verbs `f x r u .` and object `s`. */
export function createGrammarRegistry(): GrammarRegistry {
  return new DefaultGrammarRegistry();
}

function unwrap(result: RunResult): { message?: string; openPanel?: string } {
  if (!result.ok) throw new CraftError(result.code, {}, { message: result.message });
  return result;
}

export function commands(registry: GrammarRegistry): AnyCommandHandler[] {
  return [
    {
      name: "sentence.run",
      run: async (args, ctx) =>
        unwrap(
          await registry.runSentence(
            {
              count: args.count,
              verb: args.verb,
              object: args.object ?? null,
              target: args.target ?? {},
            },
            { connId: ctx.connId },
          ),
        ),
    },
    {
      name: "command.run",
      run: async (args, ctx) =>
        unwrap(await registry.runCommand(args.name, args.args ?? [], { connId: ctx.connId })),
    },
  ];
}
