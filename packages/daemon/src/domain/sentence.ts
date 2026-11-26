import { parseSentence, type GrammarTable, type ParseResult, type Sentence } from "@craft/protocol";

export { parseSentence };
export type { ParseResult };

export type SentenceCheck =
  { ok: true; owner: string } | { ok: false; reason: "no-verb" | "no-binding" | "no-count" };

/** Does the grammar table accept this sentence? Returns the owner of the binding. */
export function checkSentence(s: Sentence, table: GrammarTable): SentenceCheck {
  const verb = table.verbs.find((v) => v.key === s.verb);
  if (verb === undefined) return { ok: false, reason: "no-verb" };
  if (s.count > 1 && verb.countable === false) return { ok: false, reason: "no-count" };
  const binding = table.bindings.find((b) => b.verb === s.verb && b.object === s.object);
  return binding === undefined
    ? { ok: false, reason: "no-binding" }
    : { ok: true, owner: binding.owner };
}
