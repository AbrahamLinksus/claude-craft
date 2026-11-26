import { describe, expect, it } from "vitest";
import type { SessionView } from "@craft/protocol";
import {
  branchText,
  modelName,
  modelTone,
  queuePosition,
  readUsage,
  resetTime,
  sessionCounts,
  usageTone,
} from "../../src/renderer/shell/model.ts";

const session = (n: number, state: SessionView["state"] = "idle"): SessionView => ({
  sid: `app/s${String(n)}` as SessionView["sid"],
  repoId: "app",
  n,
  branch: `craft/s${String(n)}`,
  worktree: "C:/w",
  model: "sonnet",
  pool: "own",
  state,
  turn: 0,
  history: "repo",
  createdAt: "t",
  lastActiveAt: "t",
});

describe("shell model (US-15)", () => {
  it("names a model by family and colours Opus orange, Sonnet blue, Haiku teal", () => {
    expect(modelName("claude-sonnet-4-5")).toBe("Sonnet");
    expect(modelName("OPUS")).toBe("Opus");
    expect(modelTone("claude-opus-4")).toBe("opus");
    expect(modelTone("sonnet")).toBe("sonnet");
    expect(modelTone("claude-haiku-3")).toBe("haiku");
  });

  it("keeps an unknown model's own name in plain text", () => {
    expect(modelName("gpt-x")).toBe("gpt-x");
    expect(modelTone("gpt-x")).toBe("text");
  });

  it("turns the usage bar green, then yellow at 60%, then red at 85%", () => {
    expect(usageTone(0.1)).toBe("committed");
    expect(usageTone(0.6)).toBe("staged");
    expect(usageTone(0.85)).toBe("modified");
  });

  it("reads a missing or odd usage window as unknown", () => {
    expect(readUsage(undefined)).toEqual({});
    expect(readUsage({ fiveHour: { utilization: 0.4, resetsAt: "x" }, sevenDay: 5 })).toEqual({
      fiveHour: { utilization: 0.4, resetsAt: "x" },
    });
    expect(readUsage({ fiveHour: { utilization: "a", resetsAt: "x" } })).toEqual({});
  });

  it("formats a reset time and survives a bad date", () => {
    expect(resetTime("not a date")).toBe("?");
    expect(resetTime("2026-01-01T12:00:00.000Z")).toMatch(/^\d\d:\d\d$/);
  });

  it("counts sessions and cryo ones", () => {
    expect(sessionCounts([session(1)])).toBe("1 session");
    expect(sessionCounts([session(1), session(2, "cryo"), session(3)])).toBe("3 sessions · 1 cryo");
  });

  it("writes the queue head and the branch line", () => {
    expect(queuePosition({ position: 1, total: 3 })).toBe("1 of 3");
    expect(branchText({ name: "craft/s1", modified: 1, staged: 0, ahead: 0 })).toBe(
      "craft/s1 M1 S0 ↑0",
    );
  });
});
