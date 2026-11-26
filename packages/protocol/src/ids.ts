import { z } from "zod";

/** Repo folder slug, e.g. "notes-app", "api-2" (LLD 5.2). */
export type RepoId = string;
export type SessionKey = `${RepoId}/s${number}`;

const SESSION_KEY_PATTERN = /^([a-z0-9][a-z0-9-]*)\/s([1-9]\d*)$/;

export const repoIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
export const sessionKeySchema = z.custom<SessionKey>(
  (v) => typeof v === "string" && SESSION_KEY_PATTERN.test(v),
  "not a session key",
);

export function sessionKey(repoId: RepoId, n: number): SessionKey {
  return `${repoId}/s${String(n)}` as SessionKey;
}

export function parseSessionKey(key: string): { repoId: RepoId; n: number } | undefined {
  const m = SESSION_KEY_PATTERN.exec(key);
  if (m?.[1] === undefined || m[2] === undefined) return undefined;
  return { repoId: m[1], n: Number(m[2]) };
}

/** Short display name of a session, "s3". */
export function sessionLabel(key: SessionKey): string {
  return key.slice(key.lastIndexOf("/") + 1);
}

/** seq: global per daemon epoch. */
export interface StreamEvent<T extends string = string, D = unknown> {
  seq: number;
  ts: string;
  sid?: SessionKey | undefined;
  type: T;
  data: D;
}

/** n: per-session, file = session (LLD 4). */
export interface LogLine<T extends string = string, D = unknown> {
  v: 1;
  n: number;
  ts: string;
  type: T;
  data: D;
}

export const streamEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  ts: z.string(),
  sid: sessionKeySchema.optional(),
  type: z.string().min(1),
  data: z.unknown(),
});
