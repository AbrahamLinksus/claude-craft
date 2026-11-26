import { describe, expect, it } from "vitest";
import { InMemoryBus, SystemClock } from "../../src/bus/index.ts";
import { ManualClock } from "../_support/manual-clock.ts";

function makeBus(extra: { graft?: (type: string) => "droppable" | undefined } = {}): {
  bus: InMemoryBus;
  errors: string[];
  lags: number[];
} {
  const errors: string[] = [];
  const lags: number[] = [];
  const bus = new InMemoryBus({
    clock: new ManualClock(),
    ...(extra.graft === undefined ? {} : { graftCriticality: extra.graft }),
    hooks: {
      onError: (name) => errors.push(name),
      onLag: (_name, queued) => lags.push(queued),
    },
  });
  return { bus, errors, lags };
}

describe("bus", () => {
  it("stamps seq and ts, in order", () => {
    const { bus } = makeBus();
    const a = bus.publish({ type: "Spinner", data: {} });
    const b = bus.publish({ type: "Spinner", sid: "a/s1", data: {} });
    expect([a.seq, b.seq]).toEqual([1, 2]);
    expect(a.ts).toBe("2026-01-01T00:00:00.000Z");
    expect(b.sid).toBe("a/s1");
    expect("sid" in a).toBe(false);
    expect(bus.lastSeq()).toBe(2);
  });

  it("filters by type and sid, and stops after dispose", () => {
    const { bus } = makeBus();
    const types: number[] = [];
    const sids: number[] = [];
    const all: number[] = [];
    bus.subscribe({ types: ["Notice"] }, (e) => void types.push(e.seq));
    bus.subscribe({ sid: "a/s1" }, (e) => void sids.push(e.seq));
    const sub = bus.subscribe({}, (e) => void all.push(e.seq));
    bus.publish({ type: "Notice", data: { level: "info", text: "x" } });
    bus.publish({ type: "Spinner", sid: "a/s1", data: {} });
    sub.dispose();
    bus.publish({ type: "Spinner", data: {} });
    expect(types).toEqual([1]);
    expect(sids).toEqual([2]);
    expect(all).toEqual([1, 2]);
  });

  it("a throwing subscriber is reported and does not stop the others", async () => {
    const { bus, errors } = makeBus();
    const got: number[] = [];
    bus.subscribe(
      {},
      () => {
        throw new Error("boom");
      },
      { name: "bad" },
    );
    bus.subscribe({}, () => Promise.reject(new Error("async boom")), { name: "bad-async" });
    bus.subscribe({}, (e) => void got.push(e.seq), { name: "good" });
    bus.publish({ type: "Spinner", data: {} });
    bus.publish({ type: "Spinner", data: {} });
    await bus.idle();
    expect(got).toEqual([1, 2]);
    expect(errors).toContain("bad");
    expect(errors).toContain("bad-async");
  });

  it("awaits an async handler before handing over the next event", async () => {
    const { bus } = makeBus();
    const order: string[] = [];
    bus.subscribe({}, async (e) => {
      order.push(`start${String(e.seq)}`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`end${String(e.seq)}`);
    });
    bus.publish({ type: "Spinner", data: {} });
    bus.publish({ type: "Spinner", data: {} });
    await bus.idle();
    expect(order).toEqual(["start1", "end1", "start2", "end2"]);
  });

  it("sheds droppable events on overflow but never critical ones", async () => {
    const { bus } = makeBus();
    const seen: string[] = [];
    bus.subscribe(
      {},
      async (e) => {
        await new Promise((r) => setTimeout(r, 2));
        seen.push(e.type);
      },
      { name: "slow", capacity: 2 },
    );
    bus.publish({ type: "SessionState", sid: "a/s1", data: { state: "idle" } });
    for (let i = 0; i < 6; i++) bus.publish({ type: "Spinner", sid: "a/s1", data: {} });
    bus.publish({ type: "SessionState", sid: "a/s1", data: { state: "running" } });
    await bus.idle();
    expect(seen.filter((t) => t === "SessionState")).toHaveLength(2);
    expect(seen.filter((t) => t === "Spinner").length).toBeLessThan(6);
  });

  it("latest-wins events replace the queued one with the same key", async () => {
    const { bus } = makeBus();
    const seen: number[] = [];
    bus.subscribe({}, async (e) => {
      await new Promise((r) => setTimeout(r, 2));
      seen.push(e.seq);
    });
    bus.publish({ type: "Spinner", data: {} }); // being handled
    bus.publish({ type: "PanelState", data: { graft: "g", panel: "p", state: 1 } });
    bus.publish({ type: "PanelState", data: { graft: "g", panel: "p", state: 2 } });
    await bus.idle();
    expect(seen).toEqual([1, 3]);
  });

  it("uses a graft manifest's criticality and reports lag once", () => {
    const { bus, lags } = makeBus({ graft: () => "droppable" });
    bus.subscribe({}, () => new Promise<void>((r) => setTimeout(r, 50)), {
      name: "stuck",
      capacity: 10_000,
    });
    for (let i = 0; i < 5_100; i++)
      bus.publish({ type: "Notice", data: { level: "info", text: "x" } });
    expect(lags).toHaveLength(1);
    expect(lags[0]).toBeGreaterThan(5000);
  });

  it("the system clock tells the time and schedules, cancelling cleanly", async () => {
    const clock = new SystemClock();
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
    let ticks = 0;
    const stopEvery = clock.every(5, () => {
      ticks += 1;
    });
    let fired = false;
    clock.after(5, () => {
      fired = true;
    });
    const cancelled = clock.after(5, () => {
      throw new Error("must not run");
    });
    cancelled();
    await new Promise((r) => setTimeout(r, 40));
    stopEvery();
    expect(fired).toBe(true);
    expect(ticks).toBeGreaterThan(0);
  });
});
