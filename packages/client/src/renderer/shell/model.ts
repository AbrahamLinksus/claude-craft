import type { OpenPrompt, SessionView } from "@craft/protocol";
import type { ColorToken } from "../theme/index.ts";
import type { Mode } from "../input/index.ts";

/** Usage share at which the bar turns yellow, then red. */
export const USAGE_WARN = 0.6;
export const USAGE_HIGH = 0.85;

export const MODE_TONE: Record<Mode, ColorToken> = { TALK: "talk", LAB: "lab" };

const MODEL_FAMILIES = ["opus", "sonnet", "haiku"] as const;
type ModelFamily = (typeof MODEL_FAMILIES)[number];

function familyOf(model: string): ModelFamily | undefined {
  const lower = model.toLowerCase();
  return MODEL_FAMILIES.find((f) => lower.includes(f));
}

/** "claude-sonnet-4-5" becomes "Sonnet"; an unknown model keeps its own name. */
export function modelName(model: string): string {
  const family = familyOf(model);
  return family === undefined ? model : `${family.charAt(0).toUpperCase()}${family.slice(1)}`;
}

/** Orange Opus, blue Sonnet, teal Haiku; anything else is plain text. */
export function modelTone(model: string): ColorToken {
  return familyOf(model) ?? "text";
}

/** The `s1` part of a session. */
export function sessionLabel(s: Pick<SessionView, "n">): string {
  return `s${String(s.n)}`;
}

export interface UsageWindow {
  /** 0 to 1. */
  utilization: number;
  resetsAt: string;
}

export interface UsageView {
  fiveHour?: UsageWindow;
  sevenDay?: UsageWindow;
}

function readWindow(raw: unknown): UsageWindow | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const w = raw as Record<string, unknown>;
  if (typeof w["utilization"] !== "number" || typeof w["resetsAt"] !== "string") return undefined;
  return { utilization: w["utilization"], resetsAt: w["resetsAt"] };
}

/** The snapshot's `usage` is untyped on the wire; a missing or odd window reads as unknown. */
export function readUsage(raw: unknown): UsageView {
  if (typeof raw !== "object" || raw === null) return {};
  const u = raw as Record<string, unknown>;
  const fiveHour = readWindow(u["fiveHour"]);
  const sevenDay = readWindow(u["sevenDay"]);
  return {
    ...(fiveHour === undefined ? {} : { fiveHour }),
    ...(sevenDay === undefined ? {} : { sevenDay }),
  };
}

/** Green while there is room, yellow when it gets tight, red near the limit. */
export function usageTone(utilization: number): ColorToken {
  if (utilization >= USAGE_HIGH) return "modified";
  return utilization >= USAGE_WARN ? "staged" : "committed";
}

/** Local clock time of a reset, "17:40". */
export function resetTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "?";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "1 session", "3 sessions · 1 cryo". */
export function sessionCounts(sessions: readonly SessionView[]): string {
  const total = `${String(sessions.length)} ${sessions.length === 1 ? "session" : "sessions"}`;
  const cryo = sessions.filter((s) => s.state === "cryo").length;
  return cryo > 0 ? `${total} · ${String(cryo)} cryo` : total;
}

/** "1 of 3" for the head of the prompt queue. */
export function queuePosition(p: Pick<OpenPrompt, "position" | "total">): string {
  return `${String(p.position)} of ${String(p.total)}`;
}

export interface BranchInfo {
  name: string;
  modified: number;
  staged: number;
  ahead: number;
}

/** "craft/s1 M1 S0 ↑0". */
export function branchText(b: BranchInfo): string {
  return `${b.name} M${String(b.modified)} S${String(b.staged)} ↑${String(b.ahead)}`;
}
