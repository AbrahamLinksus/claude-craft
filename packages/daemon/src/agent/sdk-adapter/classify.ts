import type { ErrorCode } from "@craft/protocol";

/** What went wrong, in the terms of LLD 16.1. `resetsAt` only for `LIMITED`. */
export interface Classified {
  code: ErrorCode;
  message: string;
  resetsAt?: string;
}

export interface FailureFacts {
  /** `error` of an assistant message (`authentication_failed`, `rate_limit`, `overloaded`, ...). */
  kind?: string | undefined;
  /** Human text of the failure (result text or thrown message). */
  text?: string | undefined;
  /** Node error code such as `ECONNRESET`. */
  errno?: string | undefined;
  /** A `RateLimit` event with status `rejected` was seen this turn. */
  rateLimited?: boolean | undefined;
  resetsAt?: string | undefined;
}

const AUTH_KINDS = new Set([
  "authentication_failed",
  "oauth_org_not_allowed",
  "account_on_hold",
  "verification_required",
  "cloud_credential_error",
]);
const NETWORK_ERRNO = /\b(ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED)\b/;
const THROWN_PREFIX = /^Claude Code returned an error result:\s*/;
const AUTH_TEXT = /Not logged in|Invalid API key|authentication_failed|\/login/i;

function withReset(base: Classified, resetsAt: string | undefined): Classified {
  return resetsAt === undefined ? base : { ...base, resetsAt };
}

function classifyAuth(text: string): Classified {
  const code = text.startsWith("Not logged in") ? "AUTH_MISSING" : "AUTH_REJECTED";
  return { code, message: text };
}

/** Maps one failure to a Craft error code (LLD 6.2). Pure; never throws. */
export function classifyFailure(f: FailureFacts): Classified {
  const text = (f.text ?? "").replace(THROWN_PREFIX, "").trim();
  if ((f.kind !== undefined && AUTH_KINDS.has(f.kind)) || AUTH_TEXT.test(text)) {
    return classifyAuth(text);
  }
  if (f.kind === "rate_limit" || f.rateLimited === true) {
    return withReset({ code: "LIMITED", message: text }, f.resetsAt);
  }
  const network = f.errno !== undefined && NETWORK_ERRNO.test(f.errno);
  if (network || NETWORK_ERRNO.test(text)) return { code: "OFFLINE", message: text };
  if (f.kind === "overloaded" || f.kind === "server_error" || /overloaded/i.test(text)) {
    return { code: "OFFLINE", message: text };
  }
  return { code: "AGENT_ERROR", message: text };
}

function errnoOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const own = (error as { code?: unknown }).code;
  if (typeof own === "string") return own;
  const cause = (error as { cause?: unknown }).cause;
  return cause === undefined ? undefined : errnoOf(cause);
}

/** Classifies an exception thrown by the SDK iterator or a spawn. */
export function classifyThrown(error: unknown, resetsAt?: string): Classified {
  const text = error instanceof Error ? error.message : String(error);
  return classifyFailure({ text, errno: errnoOf(error), resetsAt });
}
