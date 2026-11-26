import type { Sentence } from "./commands.ts";
import type { GrammarTable, VerbDef } from "./views.ts";

export interface NextKey {
  key: string;
  name: string;
  owner: string;
}

export type ParseResult =
  | { status: "partial"; count: number; verb?: string; next: NextKey[] }
  | { status: "complete"; sentence: Sentence }
  | { status: "invalid"; hint: string };

function parseCount(keys: string): { count: number; typed: boolean; rest: string } | undefined {
  const digits = /^\d*/.exec(keys)?.[0] ?? "";
  if (digits.startsWith("0")) return undefined;
  const rest = keys.slice(digits.length);
  return digits === ""
    ? { count: 1, typed: false, rest }
    : { count: Number(digits), typed: true, rest };
}

function objectKeys(table: GrammarTable, verb: string): NextKey[] {
  const bound = new Set(table.bindings.filter((b) => b.verb === verb).map((b) => b.object));
  return table.objects.filter((o) => bound.has(o.key));
}

function parseObject(
  table: GrammarTable,
  start: { count: number; verb: string },
  objectKey: string,
): ParseResult {
  const bound = table.bindings.some((b) => b.verb === start.verb && b.object === objectKey);
  if (!bound) return { status: "invalid", hint: `${start.verb}${objectKey} does nothing` };
  const sentence: Sentence = {
    count: start.count,
    verb: start.verb,
    object: objectKey,
    target: {},
  };
  return { status: "complete", sentence };
}

function parseVerbOnly(table: GrammarTable, count: number, verb: VerbDef): ParseResult {
  const objects = objectKeys(table, verb.key);
  const noObject = table.bindings.some((b) => b.verb === verb.key && b.object === null);
  if (verb.objectless === true || (noObject && objects.length === 0)) {
    return { status: "complete", sentence: { count, verb: verb.key, object: null, target: {} } };
  }
  return { status: "partial", count, verb: verb.key, next: objects };
}

/** Pure sentence parser `[count] verb [object]` against the grammar table (LLD 13.3). */
export function parseSentence(keys: string, table: GrammarTable): ParseResult {
  const counted = parseCount(keys);
  if (counted === undefined) return { status: "invalid", hint: "a count starts with 1-9" };
  const { count, typed, rest } = counted;
  if (rest === "") {
    return { status: "partial", count, next: table.verbs.map((v) => ({ ...v })) };
  }
  const verb = table.verbs.find((v) => v.key === rest[0]);
  if (verb === undefined) return { status: "invalid", hint: `no verb on key ${rest.slice(0, 1)}` };
  if (typed && verb.countable === false) {
    return { status: "invalid", hint: `${verb.name} does not take a count` };
  }
  if (rest.length === 1) return parseVerbOnly(table, count, verb);
  if (rest.length > 2) return { status: "invalid", hint: "a sentence is a verb and an object" };
  return parseObject(table, { count, verb: verb.key }, rest.slice(1));
}
