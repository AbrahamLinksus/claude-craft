import {
  CraftError,
  emptyGrammarTable,
  type AnyCommandHandler,
  type ErrorCode,
  type GrammarTable,
  type ObjectDef,
  type Sentence,
  type SessionKey,
  type VerbDef,
} from "@craft/protocol";
import type { Disposable } from "../bus/index.ts";
import { notBuilt } from "../domain/index.ts";

export type { ObjectDef, Sentence, VerbDef };

/** Who is running the sentence or command. */
export interface RunCtx {
  sid?: SessionKey;
  connId?: string;
}

export type RunResult =
  | { ok: true; message?: string; openPanel?: string }
  | { ok: false; code: ErrorCode; message: string };

export interface Binding {
  verb: string;
  object: string | null;
  owner: string;
  run: (s: Sentence, ctx: RunCtx) => Promise<RunResult>;
}

export interface CommandDef {
  name: `:${string}`;
  title: string;
  owner: string;
  run: (args: string[], ctx: RunCtx) => Promise<RunResult>;
}

export interface PanelKeys {
  panel: string;
  owner: string;
  keys: { key: string; label: string }[];
}

export interface GrammarDef {
  verbs?: VerbDef[];
  objects?: ObjectDef[];
  bindings?: Binding[];
  commands?: CommandDef[];
  panelKeys?: PanelKeys[];
}

export interface GrammarRegistry {
  /** Throws KEY_COLLISION naming both owners. */
  add(def: GrammarDef, owner: string): Disposable;
  /** Sent in the snapshot; the client parses against it. */
  table(): GrammarTable;
  runSentence(s: Sentence, ctx: RunCtx): Promise<RunResult>;
  runCommand(name: string, args: string[], ctx: RunCtx): Promise<RunResult>;
}

/** Placeholder until the grammar task: an empty table. */
export function createGrammarRegistry(): GrammarRegistry {
  return notBuilt<GrammarRegistry>("grammar", { table: emptyGrammarTable });
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
