import { describe, expect, it } from "vitest";
import type { StreamEvent } from "../../../protocol/src/index.ts";
import {
  NOTICE_LIMIT,
  TRANSCRIPT_LIMIT,
  initialState,
} from "../../src/renderer/state/client-state.ts";
import { offlineBridge } from "../../src/renderer/state/offline-bridge.ts";
import { applyEvent } from "../../src/renderer/state/reducers.ts";
import { CraftStore } from "../../src/renderer/state/store.ts";
import { emptySnapshot } from "../_support/fake-worker.ts";

let seq = 0;
function ev(type: string, data: unknown, sid?: string): StreamEvent {
  seq += 1;
  return {
    seq,
    ts: "2026-01-01T00:00:00.000Z",
    type,
    data,
    ...(sid === undefined ? {} : { sid: sid as "a/s1" }),
  };
}

const created = {
  repoId: "api",
  n: 1,
  branch: "craft/s1",
  worktree: "C:/w",
  model: "sonnet",
  pool: "own",
  baseSha: "abc",
  history: "repo",
};

function manualScheduler(): { schedule: (cb: () => void) => void; run: () => void; calls: number } {
  const queue: (() => void)[] = [];
  const s = {
    calls: 0,
    schedule: (cb: () => void) => {
      s.calls += 1;
      queue.push(cb);
    },
    run: () => {
      for (const cb of queue.splice(0)) cb();
    },
  };
  return s;
}

describe("client store (LLD 13.2)", () => {
  it("starts empty and not loaded, connecting", () => {
    const state = initialState();
    expect(state).toMatchObject({ loaded: false, repos: [], sessions: [] });
    expect(state.link).toEqual({ status: "connecting" });
  });

  it("a snapshot replaces the state but keeps the link state", () => {
    const store = new CraftStore(() => undefined);
    store.setLink({ status: "reconnecting" });
    const snapshot = {
      ...emptySnapshot(),
      repos: [{ repoId: "api", repoKey: "k", path: "C:/api", name: "api", lastOpened: "t" }],
    };
    store.applySnapshot(snapshot, 12);
    expect(store.getState().loaded).toBe(true);
    expect(store.getState().repos).toHaveLength(1);
    expect(store.getState().link).toEqual({ status: "reconnecting" });
    expect(store.lastSeq()).toBe(12);
  });

  it("applies events in one batch per frame and ignores ones it already has", () => {
    const sched = manualScheduler();
    const store = new CraftStore(sched.schedule);
    let notified = 0;
    const off = store.subscribe(() => (notified += 1));
    store.applySnapshot(emptySnapshot(), 100);
    notified = 0;
    store.applyEvents([{ seq: 50, ts: "t", type: "Notice", data: { level: "info", text: "old" } }]);
    expect(sched.calls).toBe(0);
    store.applyEvents([
      { seq: 101, ts: "t", type: "Notice", data: { level: "info", text: "a" } },
      { seq: 102, ts: "t", type: "Notice", data: { level: "warn", text: "b" } },
    ]);
    store.applyEvents([{ seq: 103, ts: "t", type: "Notice", data: { level: "info", text: "c" } }]);
    expect(sched.calls).toBe(1);
    expect(store.getState().notices).toHaveLength(0);
    sched.run();
    expect(store.getState().notices.map((n) => n.text)).toEqual(["a", "b", "c"]);
    expect(notified).toBe(1);
    expect(store.lastSeq()).toBe(103);
    off();
    store.setLink({ status: "connected" });
    expect(notified).toBe(1);
  });

  it("a new snapshot drops events still waiting for the next frame", () => {
    const sched = manualScheduler();
    const store = new CraftStore(sched.schedule);
    store.applyEvents([{ seq: 1, ts: "t", type: "Notice", data: { level: "info", text: "x" } }]);
    store.applySnapshot(emptySnapshot(), 5);
    sched.run();
    expect(store.getState().notices).toEqual([]);
  });
});

describe("reducers", () => {
  it("creates a session once, then follows its state, prompts and text", () => {
    let s = initialState();
    s = applyEvent(s, ev("SessionCreated", created));
    s = applyEvent(s, ev("SessionCreated", created));
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0]).toMatchObject({ sid: "api/s1", state: "starting" });

    s = applyEvent(s, ev("SessionState", { state: "cryo", cryo: { reason: "limit" } }, "api/s1"));
    expect(s.sessions[0]).toMatchObject({ state: "cryo", cryo: { reason: "limit" } });
    s = applyEvent(s, ev("SessionState", { state: "running" }, "api/s1"));
    expect(s.sessions[0]?.cryo).toBeUndefined();

    s = applyEvent(s, ev("UserPrompt", { turn: 1, text: "hi", origin: "user" }, "api/s1"));
    s = applyEvent(
      s,
      ev("AgentText", { turn: 1, msgId: "m", text: "He", partial: true }, "api/s1"),
    );
    s = applyEvent(
      s,
      ev("AgentText", { turn: 1, msgId: "m", text: "Hello", partial: false }, "api/s1"),
    );
    expect(s.sessions[0]?.transcript).toEqual([
      { kind: "user", text: "hi" },
      { kind: "agent", msgId: "m", text: "Hello" },
    ]);
    expect(s.sessions[0]?.turn).toBe(1);
  });

  it("keeps the newest lines and notices only", () => {
    let s = applyEvent(initialState(), ev("SessionCreated", created));
    for (let i = 0; i < TRANSCRIPT_LIMIT + 5; i++) {
      s = applyEvent(s, ev("UserPrompt", { turn: i, text: String(i), origin: "u" }, "api/s1"));
    }
    expect(s.sessions[0]?.transcript).toHaveLength(TRANSCRIPT_LIMIT);
    for (let i = 0; i < NOTICE_LIMIT + 3; i++) {
      s = applyEvent(s, ev("Notice", { level: "info", text: String(i) }));
    }
    expect(s.notices).toHaveLength(NOTICE_LIMIT);
    expect(s.notices.at(-1)?.text).toBe(String(NOTICE_LIMIT + 2));
  });

  it("tracks the prompt queue and panel state", () => {
    let s = applyEvent(initialState(), ev("PromptQueueChanged", { count: 2 }));
    expect(s.prompt).toEqual({ count: 2 });
    const head = {
      id: "p",
      kind: "hold",
      source: "x",
      title: "t",
      options: [],
      position: 1,
      total: 2,
    };
    s = applyEvent(s, ev("PromptQueueChanged", { head, count: 2 }));
    expect(s.prompt.head?.id).toBe("p");
    s = applyEvent(s, ev("PanelState", { graft: "usage", panel: "bar", state: { pct: 40 } }));
    expect(s.panels["usage/bar"]).toEqual({ pct: 40 });
  });

  it("leaves the state alone for unknown, graft, unhandled and malformed events, and unknown sessions", () => {
    const s = initialState();
    expect(applyEvent(s, ev("radar/Tick", {}))).toBe(s);
    expect(applyEvent(s, ev("Spinner", {}))).toBe(s);
    expect(applyEvent(s, ev("Notice", { level: "loud" }))).toBe(s);
    expect(applyEvent(s, ev("SessionState", { state: "idle" }, "api/s9")).sessions).toEqual([]);
    expect(applyEvent(s, ev("SessionState", { state: "idle" }))).toBe(s);
  });
});

describe("offline bridge (page opened without Electron)", () => {
  it("shows reconnecting, refuses commands in plain words and never picks a folder", async () => {
    const bridge = offlineBridge();
    const states: string[] = [];
    bridge.onLinkState((s) => states.push(s.status));
    expect(states).toEqual(["reconnecting"]);
    const reply = await bridge.send({ name: "repo.open", args: {} });
    expect(reply).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect(await bridge.pickFolder()).toBeUndefined();
    await bridge.ready();
    bridge.onMessage(() => undefined)();
    bridge.log("info", "x");
  });
});
