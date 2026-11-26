import {
  CraftError,
  describeError,
  isCraftError,
  type GrammarTable,
  type Sentence,
} from "@craft/protocol";
import type { Disposable } from "../bus/index.ts";
import { claimsOf, reservedClaims } from "./claims.ts";
import type {
  Binding,
  CommandDef,
  GrammarDef,
  GrammarRegistry,
  RunCtx,
  RunResult,
} from "./types.ts";

export const CORE_OWNER = "core";

/** Core verbs `f x r u .` and object `s` (LLD 10.2). */
const CORE_DEF: GrammarDef = {
  verbs: [
    { key: "f", name: "fork", owner: CORE_OWNER },
    { key: "x", name: "stop", owner: CORE_OWNER },
    { key: "r", name: "resume", owner: CORE_OWNER },
    { key: "u", name: "undo", owner: CORE_OWNER, objectless: true, countable: false },
    { key: ".", name: "repeat", owner: CORE_OWNER, objectless: true, countable: false },
  ],
  objects: [{ key: "s", name: "session", owner: CORE_OWNER }],
};

interface Entry {
  owner: string;
  def: GrammarDef;
}

/** A failure the owner can read: the plain-words message, never a stack. */
function failure(error: unknown): RunResult {
  if (isCraftError(error)) return { ok: false, code: error.code, message: error.userMessage };
  return { ok: false, code: "INTERNAL", message: describeError("INTERNAL") };
}

export class DefaultGrammarRegistry implements GrammarRegistry {
  private readonly entries: Entry[] = [{ owner: CORE_OWNER, def: CORE_DEF }];

  add(def: GrammarDef, owner: string): Disposable {
    this.checkCollisions(def, owner);
    const entry: Entry = { owner, def };
    this.entries.push(entry);
    return {
      dispose: () => {
        const at = this.entries.indexOf(entry);
        if (at >= 0) this.entries.splice(at, 1);
      },
    };
  }

  table(): GrammarTable {
    const defs = this.entries;
    return {
      verbs: defs.flatMap((e) => e.def.verbs ?? []).map((v) => ({ ...v })),
      objects: defs.flatMap((e) => e.def.objects ?? []).map((o) => ({ ...o })),
      bindings: defs.flatMap((e) =>
        (e.def.bindings ?? []).map((b) => ({ verb: b.verb, object: b.object, owner: b.owner })),
      ),
      commands: defs.flatMap((e) =>
        (e.def.commands ?? []).map((c) => ({ name: c.name, title: c.title, owner: c.owner })),
      ),
      panelKeys: defs.flatMap((e) =>
        (e.def.panelKeys ?? []).map((p) => ({
          panel: p.panel,
          owner: p.owner,
          keys: p.keys.map((k) => ({ ...k })),
        })),
      ),
    };
  }

  async runSentence(s: Sentence, ctx: RunCtx): Promise<RunResult> {
    const binding = this.entries
      .flatMap((e) => e.def.bindings ?? [])
      .find((b: Binding) => b.verb === s.verb && b.object === s.object);
    if (binding === undefined) {
      const typed = `${s.verb}${s.object ?? ""}`;
      return { ok: false, code: "INVALID_KEY", message: `${typed} does nothing` };
    }
    return this.guarded(() => binding.run(s, ctx));
  }

  async runCommand(name: string, args: string[], ctx: RunCtx): Promise<RunResult> {
    const wanted = name.startsWith(":") ? name : `:${name}`;
    const command = this.entries
      .flatMap((e) => e.def.commands ?? [])
      .find((c: CommandDef) => c.name === wanted);
    if (command === undefined) {
      return { ok: false, code: "INVALID_KEY", message: `${wanted} is not a command` };
    }
    return this.guarded(() => command.run(args, ctx));
  }

  private async guarded(run: () => Promise<RunResult>): Promise<RunResult> {
    try {
      return await run();
    } catch (error) {
      return failure(error);
    }
  }

  /** Throws KEY_COLLISION before anything is added, so a failed `add` changes nothing. */
  private checkCollisions(def: GrammarDef, owner: string): void {
    for (const c of reservedClaims(def)) {
      throw new CraftError("KEY_COLLISION", { k: c.shown, a: "client", b: owner });
    }
    const taken = new Map<string, string>();
    for (const entry of this.entries) {
      for (const c of claimsOf(entry.def)) taken.set(c.id, entry.owner);
    }
    for (const c of claimsOf(def)) {
      const other = taken.get(c.id);
      if (other !== undefined)
        throw new CraftError("KEY_COLLISION", { k: c.shown, a: other, b: owner });
      taken.set(c.id, owner);
    }
  }
}
