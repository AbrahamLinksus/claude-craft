import { describe, expect, it } from "vitest";
import { parseSentence, type GrammarTable } from "@craft/protocol";
import {
  allocateNumber,
  branchFor,
  checkCap,
  checkSentence,
  isLive,
  nextAfter,
  notBuilt,
  orderInterceptors,
  planStart,
  sessionKeyFor,
  transition,
} from "../../src/domain/index.ts";

describe("numbering", () => {
  it("counts up from 1 and never reuses a number", () => {
    expect(allocateNumber(1)).toEqual({ n: 1, nextN: 2 });
    expect(allocateNumber(0)).toEqual({ n: 1, nextN: 2 });
    expect(allocateNumber(7.9)).toEqual({ n: 7, nextN: 8 });
    expect(sessionKeyFor("api-2", 3)).toBe("api-2/s3");
    expect(branchFor(3)).toBe("craft/s3");
  });

  it("finds the first free number when nextN was lost", () => {
    expect(nextAfter([])).toBe(1);
    expect(nextAfter([1, 4, 2])).toBe(5);
  });
});

describe("caps", () => {
  const sessions = [
    { state: "running", pool: "own" },
    { state: "idle", pool: "own" },
    { state: "cryo", pool: "own" },
    { state: "running", pool: "team" },
  ] as const;

  it("counts live sessions per pool against that pool's own limit", () => {
    expect(checkCap(sessions, "own", { cap: 5, teamCap: 8 })).toEqual({
      pool: "own",
      limit: 5,
      live: 2,
      free: 3,
    });
    expect(checkCap(sessions, "team", { cap: 5, teamCap: 1 })).toMatchObject({ live: 1, free: 0 });
    expect(isLive("graveyard")).toBe(false);
    expect(isLive("paused")).toBe(true);
  });

  it("plans a start: all, only some fit, or none", () => {
    expect(planStart(2, 3)).toEqual({ kind: "all", start: 2 });
    expect(planStart(4, 2)).toEqual({ kind: "partial", start: 2, asked: 4 });
    expect(planStart(1, 0)).toEqual({ kind: "none" });
  });
});

describe("chain order", () => {
  it("sorts by phase, then by registration order, without touching the input", () => {
    const input = [
      { id: "a", phase: "policy" },
      { id: "b", phase: "guard" },
      { id: "c", phase: "policy" },
      { id: "d", phase: "collision" },
    ] as const;
    expect(orderInterceptors(input).map((i) => i.id)).toEqual(["b", "d", "a", "c"]);
    expect(input.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("session state machine", () => {
  it("moves through the normal turn cycle", () => {
    expect(transition("starting", { type: "started" })).toEqual({ state: "running" });
    expect(transition("running", { type: "turnFinished" })).toEqual({ state: "idle" });
    expect(transition("idle", { type: "prompt" })).toEqual({ state: "running" });
    expect(transition("running", { type: "offline" })).toEqual({ state: "retrying" });
    expect(transition("retrying", { type: "online" })).toEqual({ state: "running" });
    expect(transition("idle", { type: "pause" })).toEqual({ state: "paused" });
    expect(transition("paused", { type: "unpause" })).toEqual({ state: "running" });
    expect(transition("idle", { type: "toGraveyard" })).toEqual({ state: "graveyard" });
    expect(transition("graveyard", { type: "fromGraveyard" })).toEqual({ state: "idle" });
    expect(transition("starting", { type: "startFailed" })).toEqual({ state: "failed" });
    expect(transition("cryo", { type: "resume" })).toEqual({ state: "starting" });
  });

  it("freezes into cryo with the reason", () => {
    expect(transition("running", { type: "limit", resetsAt: "x" })).toEqual({
      state: "cryo",
      cryo: { reason: "limit", resetsAt: "x" },
    });
    expect(transition("running", { type: "limit" })).toEqual({
      state: "cryo",
      cryo: { reason: "limit" },
    });
    expect(transition("retrying", { type: "offlineTimeout" })?.cryo?.reason).toBe("offline");
    expect(transition("idle", { type: "stop" })?.cryo?.reason).toBe("stopped");
    expect(transition("idle", { type: "daemonRestart", midTurn: false })?.cryo?.reason).toBe(
      "daemon-restart",
    );
    expect(transition("running", { type: "daemonRestart", midTurn: true })?.cryo?.reason).toBe(
      "interrupted",
    );
  });

  it("refuses transitions that are not in the diagram", () => {
    expect(transition("cryo", { type: "prompt" })).toBeUndefined();
    expect(transition("graveyard", { type: "stop" })).toBeUndefined();
  });
});

describe("sentence", () => {
  const table: GrammarTable = {
    verbs: [
      { key: "f", name: "fork", owner: "core", countable: true },
      { key: "u", name: "undo", owner: "core", objectless: true, countable: false },
    ],
    objects: [{ key: "s", name: "session", owner: "core" }],
    bindings: [
      { verb: "f", object: "s", owner: "core" },
      { verb: "u", object: null, owner: "git" },
    ],
    commands: [],
    panelKeys: [],
  };

  it("parses count, verb and object", () => {
    const done = parseSentence("3fs", table);
    expect(done).toMatchObject({
      status: "complete",
      sentence: { count: 3, verb: "f", object: "s" },
    });
    expect(parseSentence("3f", table)).toMatchObject({ status: "partial", verb: "f" });
    expect(parseSentence("3", table)).toMatchObject({ status: "partial", count: 3 });
    expect(parseSentence("u", table)).toMatchObject({ status: "complete" });
  });

  it("explains why a sentence is invalid", () => {
    expect(parseSentence("0f", table)).toMatchObject({ status: "invalid" });
    expect(parseSentence("2u", table)).toMatchObject({ status: "invalid" });
    expect(parseSentence("zs", table)).toMatchObject({ status: "invalid" });
    expect(parseSentence("fsx", table)).toMatchObject({ status: "invalid" });
    expect(parseSentence("fz", table)).toMatchObject({ status: "invalid" });
  });

  it("checks a sentence against the table and names the owner", () => {
    const base = { count: 1, verb: "f", object: "s", target: {} };
    expect(checkSentence(base, table)).toEqual({ ok: true, owner: "core" });
    expect(checkSentence({ ...base, verb: "q" }, table)).toEqual({ ok: false, reason: "no-verb" });
    expect(checkSentence({ ...base, object: null }, table)).toEqual({
      ok: false,
      reason: "no-binding",
    });
    expect(checkSentence({ ...base, verb: "u", object: null, count: 2 }, table)).toEqual({
      ok: false,
      reason: "no-count",
    });
  });
});

describe("notBuilt stubs", () => {
  interface Port {
    ready(): boolean;
    go(): void;
  }

  it("fails closed with INTERNAL for what is not built, and keeps what is given", () => {
    const stub = notBuilt<Port>("demo", { ready: () => true });
    expect(stub.ready()).toBe(true);
    expect(() => {
      stub.go();
    }).toThrow(/Something went wrong inside Craft/);
  });
});
