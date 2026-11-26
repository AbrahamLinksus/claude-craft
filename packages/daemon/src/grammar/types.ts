import type {
  ErrorCode,
  GrammarTable,
  ObjectDef,
  Sentence,
  SessionKey,
  VerbDef,
} from "@craft/protocol";
import type { Disposable } from "../bus/index.ts";

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

export type { ObjectDef, Sentence, VerbDef };
