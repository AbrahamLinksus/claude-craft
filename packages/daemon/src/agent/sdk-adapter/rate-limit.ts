import type { CoreEventData } from "@craft/protocol";

type RateLimitData = CoreEventData<"RateLimit">;
type Window = NonNullable<RateLimitData["fiveHour"]>;

const STATUSES = ["allowed", "allowed_warning", "rejected"] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isoFromUnix(v: unknown): string | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const d = new Date(v * 1000);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function windowOf(v: unknown): Window | undefined {
  if (!isRecord(v)) return undefined;
  const resetsAt = isoFromUnix(v["resetsAt"]);
  const utilization = v["utilization"];
  if (resetsAt === undefined || typeof utilization !== "number") return undefined;
  return { utilization, resetsAt };
}

function statusOf(v: unknown): RateLimitData["status"] {
  return STATUSES.find((s) => s === v) ?? "unknown";
}

/**
 * `rate_limit_event.rate_limit_info` read structurally (LLD 6.2): `unifiedWindows.five_hour` /
 * `seven_day`, else the top-level `rateLimitType` + `utilization` + `resetsAt`. A window that is
 * missing or malformed is omitted. Never throws.
 */
export function readRateLimit(info: unknown): RateLimitData {
  if (!isRecord(info)) return { status: "unknown" };
  const unified = isRecord(info["unifiedWindows"]) ? info["unifiedWindows"] : {};
  const top = windowOf(info);
  const type = info["rateLimitType"];
  const fiveHour = windowOf(unified["five_hour"]) ?? (type === "five_hour" ? top : undefined);
  const sevenDay = windowOf(unified["seven_day"]) ?? (type === "seven_day" ? top : undefined);
  const resetsAt = isoFromUnix(info["resetsAt"]);
  return {
    status: statusOf(info["status"]),
    ...(fiveHour ? { fiveHour } : {}),
    ...(sevenDay ? { sevenDay } : {}),
    ...(resetsAt ? { resetsAt } : {}),
  };
}
