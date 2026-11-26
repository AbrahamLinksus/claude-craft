import { z } from "zod";
import { commandNameSchema } from "./commands.ts";
import { errorCodeSchema } from "./errors.ts";
import { streamEventSchema } from "./ids.ts";
import { snapshotSchema } from "./views.ts";

/** A 32-byte nonce in base64 is exactly 44 characters (LLD 1.3). */
export const NONCE_CHARS = 44;

const snapshotReplyShape = { seq: z.number().int(), state: snapshotSchema };

/** The body of `snapshot.get` and of the handshake `snapshot`: state as of `seq`. */
export const snapshotReplySchema = z.object(snapshotReplyShape);
export type SnapshotReply = z.infer<typeof snapshotReplySchema>;

const resumeSchema = z.object({ epoch: z.number(), lastSeq: z.number().int().nonnegative() });

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    protocol: z.number().int(),
    clientVersion: z.string(),
    clientNonce: z.string().length(NONCE_CHARS),
  }),
  z.object({ type: z.literal("auth"), proof: z.string().min(1), resume: resumeSchema.optional() }),
  z.object({
    type: z.literal("cmd"),
    id: z.string().min(1),
    name: commandNameSchema,
    args: z.unknown(),
  }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const daemonMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("challenge"),
    daemonVersion: z.string(),
    epoch: z.number(),
    serverNonce: z.string().length(NONCE_CHARS),
    proof: z.string(),
  }),
  z.object({ type: z.literal("snapshot"), ...snapshotReplyShape }),
  z.object({ type: z.literal("events"), items: z.array(streamEventSchema) }),
  z.object({ type: z.literal("resync") }),
  z.discriminatedUnion("ok", [
    z.object({ type: z.literal("reply"), id: z.string(), ok: z.literal(true), data: z.unknown() }),
    z.object({
      type: z.literal("reply"),
      id: z.string(),
      ok: z.literal(false),
      error: z.object({ code: errorCodeSchema, message: z.string() }),
    }),
  ]),
  z.object({ type: z.literal("bye"), code: errorCodeSchema, message: z.string() }),
]);
export type DaemonMessage = z.infer<typeof daemonMessageSchema>;
export type Reply = Extract<DaemonMessage, { type: "reply" }>;

export type ParsedLine<T> = { ok: true; value: T } | { ok: false; reason: string };

export function encodeLine(msg: ClientMessage | DaemonMessage): string {
  return `${JSON.stringify(msg)}\n`;
}

function parseWith<T>(schema: z.ZodType<T>, line: string): ParsedLine<T> {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return { ok: false, reason: "not JSON" };
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: "bad message" };
}

export function parseClientLine(line: string): ParsedLine<ClientMessage> {
  return parseWith(clientMessageSchema, line);
}

export function parseDaemonLine(line: string): ParsedLine<DaemonMessage> {
  return parseWith(daemonMessageSchema, line);
}
