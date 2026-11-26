import { z } from "zod";

/** Every code of LLD 16.1, plus INTERNAL for bugs (never shown with a stack trace). */
export const ERROR_CODES = [
  "NOT_A_GIT_REPO",
  "NO_COMMITS",
  "CAP_REACHED",
  "AUTH_MISSING",
  "AUTH_REJECTED",
  "LIMITED",
  "OFFLINE",
  "GIT_CONFLICT",
  "ALREADY_PUSHED",
  "KEY_COLLISION",
  "GRAFT_NEEDS_MISSING",
  "CAPABILITY_DENIED",
  "GRAFT_CRASHED",
  "WORKTREE_IN_USE",
  "UNAUTHORIZED",
  "PROTOCOL_ERROR",
  "PIPE_TAKEN",
  "GIT_FAILED",
  "GIT_NOT_FOUND",
  "AGENT_ERROR",
  "GRAFT_INVALID",
  "GRAFT_API_MISMATCH",
  "UNDO_UNAVAILABLE",
  "PROMPT_CANCELLED",
  "INVALID_KEY",
  "NOT_ON_SCREEN",
  "BUS_LAG",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
export const errorCodeSchema = z.enum(ERROR_CODES);

/** Plain-words templates; `<name>` is replaced from the params of the error. */
export const ERROR_TEMPLATES: Readonly<Record<ErrorCode, string>> = {
  NOT_A_GIT_REPO: "not a git repo: <path>",
  NO_COMMITS: "<repo> has no commits yet: make a first commit, then start a session",
  CAP_REACHED: "<running> of <cap> sessions running; raise the cap in settings or stop one (xs)",
  AUTH_MISSING: "No sign-in yet: choose one in :settings",
  AUTH_REJECTED:
    "Claude refused the sign-in: sign in through Claude's own sign-in, or switch to an API key in :settings",
  LIMITED: "still limited · resumes after <time>",
  OFFLINE: "retrying… / cryo · offline",
  GIT_CONFLICT: "<op> stopped: <files> conflict; <branch> unchanged",
  ALREADY_PUSHED: "already pushed, can't undo",
  KEY_COLLISION: "Key <k> claimed by <a> and <b>",
  GRAFT_NEEDS_MISSING: "<a> needs <b>: install it from the shelf (:graft)",
  CAPABILITY_DENIED: "<graft> tried to <capability> without declaring it",
  GRAFT_CRASHED: "<session>: <graft> crashed while checking <tool> <path> · a allow · d deny",
  WORKTREE_IN_USE: "<path> is in use by another program; close it and try again",
  UNAUTHORIZED:
    "Craft's background worker could not confirm this connection is yours; restart Craft",
  PROTOCOL_ERROR: "Craft received a message it could not understand and closed the connection",
  PIPE_TAKEN: "Another program is using Craft's connection name",
  GIT_FAILED: "git failed: <message>",
  GIT_NOT_FOUND: "git not found: install Git for Windows",
  AGENT_ERROR: "The agent stopped with an error; try again or check the log",
  GRAFT_INVALID: "<graft> has a broken graft.json and was skipped",
  GRAFT_API_MISMATCH: "<graft> was built for another version of Craft and was skipped",
  UNDO_UNAVAILABLE: "turn on <graft> to undo this",
  PROMPT_CANCELLED: "the question was cancelled",
  INVALID_KEY: "that key is not an answer here",
  NOT_ON_SCREEN: "that question is no longer on screen",
  BUS_LAG: "Craft is falling behind on events; some panels may be slow",
  INTERNAL: "Something went wrong inside Craft; see the log",
};

export type ErrorParams = Readonly<Record<string, string>>;

/** Fill `<name>` placeholders; unknown placeholders stay as written. */
export function describeError(code: ErrorCode, params: ErrorParams = {}): string {
  return ERROR_TEMPLATES[code].replace(/<(\w+)>/g, (whole, name: string) => params[name] ?? whole);
}

export class CraftError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly details: unknown;

  constructor(code: ErrorCode, params: ErrorParams = {}, details?: unknown) {
    const userMessage = describeError(code, params);
    super(userMessage);
    this.name = "CraftError";
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }
}

export function isCraftError(e: unknown): e is CraftError {
  return e instanceof CraftError;
}
