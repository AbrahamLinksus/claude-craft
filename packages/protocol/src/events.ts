import { z } from "zod";
import { errorCodeSchema } from "./errors.ts";
import { sessionKeySchema, type StreamEvent } from "./ids.ts";

export type Criticality = "critical" | "latest-wins" | "droppable";

export const SESSION_STATES = [
  "starting",
  "idle",
  "running",
  "retrying",
  "paused",
  "cryo",
  "graveyard",
  "failed",
] as const;
export const sessionStateSchema = z.enum(SESSION_STATES);
export type SessionStateName = z.infer<typeof sessionStateSchema>;

export const CRYO_REASONS = [
  "limit",
  "stopped",
  "offline",
  "interrupted",
  "daemon-restart",
  "parked",
] as const;
export const cryoSchema = z.object({
  reason: z.enum(CRYO_REASONS),
  resetsAt: z.string().optional(),
  message: z.string().optional(),
});
export type Cryo = z.infer<typeof cryoSchema>;

const poolSchema = z.enum(["own", "team"]);
const tokensSchema = z.object({
  in: z.number(),
  out: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
});
const windowSchema = z.object({ utilization: z.number(), resetsAt: z.string() });
const turn = z.number().int().nonnegative();

export const openPromptSchema = z.object({
  id: z.string(),
  kind: z.enum(["hold", "approval", "confirm", "choice"]),
  sid: sessionKeySchema.optional(),
  source: z.string(),
  title: z.string(),
  body: z.array(z.string()).optional(),
  options: z.array(z.object({ key: z.string(), label: z.string() })),
  front: z.boolean().optional(),
  position: z.number().int(),
  total: z.number().int(),
});
export type OpenPrompt = z.infer<typeof openPromptSchema>;

/** Data schema of every core event (LLD 1.2). */
export const EVENT_SCHEMAS = {
  SessionCreated: z.object({
    repoId: z.string(),
    n: z.number().int(),
    branch: z.string(),
    worktree: z.string(),
    model: z.string(),
    pool: poolSchema,
    parent: z.object({ sid: sessionKeySchema, turn, batch: z.string() }).optional(),
    baseSha: z.string(),
    history: z.enum(["repo", "home"]),
  }),
  SessionState: z.object({ state: sessionStateSchema, cryo: cryoSchema.optional() }),
  UserPrompt: z.object({ turn, text: z.string(), origin: z.string() }),
  AgentText: z.object({
    turn,
    msgId: z.string(),
    text: z.string(),
    partial: z.boolean(),
    agentId: z.string().optional(),
  }),
  ToolStarted: z.object({
    turn,
    toolUseId: z.string(),
    tool: z.string(),
    input: z.unknown(),
    paths: z.array(z.string()),
    agentId: z.string().optional(),
  }),
  ToolDecision: z.object({
    toolUseId: z.string(),
    decision: z.enum(["allowed", "held", "denied"]),
    by: z.string(),
    reason: z.string().optional(),
  }),
  ToolFinished: z.object({ toolUseId: z.string(), ok: z.boolean(), output: z.string() }),
  SubagentStarted: z.object({ turn, agentId: z.string(), description: z.string() }),
  TurnFinished: z.object({
    turn,
    outcome: z.enum(["success", "error", "interrupted", "limit", "offline"]),
    lastMessageId: z.string(),
    tokens: tokensSchema,
    costUsdTotal: z.number(),
    durationMs: z.number(),
    error: errorCodeSchema.optional(),
  }),
  TurnCommitted: z.object({ turn, sha: z.string().nullable() }),
  RateLimit: z.object({
    status: z.enum(["allowed", "allowed_warning", "rejected", "unknown"]),
    fiveHour: windowSchema.optional(),
    sevenDay: windowSchema.optional(),
    resetsAt: z.string().optional(),
  }),
  GitStatusChanged: z.object({
    modified: z.number(),
    staged: z.number(),
    untracked: z.number(),
    ahead: z.number(),
    files: z.array(z.object({ path: z.string(), code: z.string() })).max(2000),
  }),
  Spinner: z.object({}),
  PromptQueueChanged: z.object({ head: openPromptSchema.optional(), count: z.number().int() }),
  PanelState: z.object({ graft: z.string(), panel: z.string(), state: z.unknown() }),
  GraftStatus: z.object({
    graft: z.string(),
    status: z.enum(["loaded", "disabled", "error", "awaiting-leaflet"]),
    message: z.string().optional(),
  }),
  Notice: z.object({
    level: z.enum(["info", "warn", "error"]),
    text: z.string(),
    code: errorCodeSchema.optional(),
  }),
  DaemonStarted: z.object({ epoch: z.number(), recovered: z.array(sessionKeySchema) }),
} as const;

export type CoreEventType = keyof typeof EVENT_SCHEMAS;
export type CoreEventData<T extends CoreEventType> = z.infer<(typeof EVENT_SCHEMAS)[T]>;
export type CoreEvent = {
  [T in CoreEventType]: StreamEvent<T, CoreEventData<T>>;
}[CoreEventType];
export type GraftEvent = StreamEvent<`${string}/${string}`>;
export type AnyEvent = CoreEvent | GraftEvent;

/** What a publisher passes to `Bus.publish`: seq and ts are assigned by the bus. */
export type EventInput<E extends AnyEvent = AnyEvent> = E extends AnyEvent
  ? Omit<E, "seq" | "ts">
  : never;

interface EventMeta {
  /** `AgentText` is critical only when complete (partial: false). */
  criticality: Criticality;
  logged: boolean | "if-sid";
}

/** Criticality and log flag per core event (LLD 1.2). */
export const EVENT_META: Readonly<Record<CoreEventType, EventMeta>> = {
  SessionCreated: { criticality: "critical", logged: true },
  SessionState: { criticality: "critical", logged: true },
  UserPrompt: { criticality: "critical", logged: true },
  AgentText: { criticality: "critical", logged: true },
  ToolStarted: { criticality: "critical", logged: true },
  ToolDecision: { criticality: "critical", logged: true },
  ToolFinished: { criticality: "critical", logged: true },
  SubagentStarted: { criticality: "critical", logged: true },
  TurnFinished: { criticality: "critical", logged: true },
  TurnCommitted: { criticality: "critical", logged: true },
  RateLimit: { criticality: "critical", logged: true },
  GitStatusChanged: { criticality: "latest-wins", logged: false },
  Spinner: { criticality: "droppable", logged: false },
  PromptQueueChanged: { criticality: "critical", logged: false },
  PanelState: { criticality: "latest-wins", logged: false },
  GraftStatus: { criticality: "critical", logged: false },
  Notice: { criticality: "critical", logged: "if-sid" },
  DaemonStarted: { criticality: "critical", logged: false },
};

export function isCoreEventType(type: string): type is CoreEventType {
  return Object.hasOwn(EVENT_META, type);
}

/** Resolves the criticality of a graft event type (from its manifest); unknown = critical. */
export type GraftCriticality = (type: string) => Criticality | undefined;

export function criticalityOf(
  e: { type: string; data: unknown },
  graft?: GraftCriticality,
): Criticality {
  if (!isCoreEventType(e.type)) return graft?.(e.type) ?? "critical";
  if (e.type === "AgentText") {
    const partial = (e.data as { partial?: unknown }).partial === true;
    return partial ? "droppable" : "critical";
  }
  return EVENT_META[e.type].criticality;
}

export function isLogged(e: { type: string; sid?: string | undefined; data: unknown }): boolean {
  if (!isCoreEventType(e.type)) return e.sid !== undefined;
  const flag = EVENT_META[e.type].logged;
  if (e.type === "AgentText") return (e.data as { partial?: unknown }).partial !== true;
  return flag === "if-sid" ? e.sid !== undefined : flag;
}

/** Key under which a latest-wins event replaces an older one, or undefined. */
export function latestWinsKey(e: {
  type: string;
  sid?: string | undefined;
  data: unknown;
}): string | undefined {
  if (e.type === "PanelState") {
    const d = e.data as { graft?: unknown; panel?: unknown };
    return `PanelState:${String(d.graft)}/${String(d.panel)}`;
  }
  return `${e.type}:${e.sid ?? ""}`;
}
