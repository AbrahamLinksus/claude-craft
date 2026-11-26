import { describe, expect, it } from "vitest";
import { STREAM_RING_SIZE, type StreamEvent } from "@craft/protocol";
import { OwnerOnlyAcl, type FileRunner } from "../../src/process/index.ts";
import { StreamRing, TokenFile, defaultAddress, isAddressInUse } from "../../src/server/index.ts";
import { EventBatch } from "../../src/server/event-batch.ts";
import { LineReader } from "../../src/server/line-reader.ts";
import { MemoryFileSystem } from "../_support/memory-fs.ts";
import { memoryLogger } from "../_support/memory-log.ts";

function ev(seq: number, type = "Notice", data: unknown = {}, sid?: string): StreamEvent {
  return { seq, ts: "t", type, data, ...(sid === undefined ? {} : { sid: sid as "a/s1" }) };
}

describe("stream ring", () => {
  it("returns what came after a seq, and 'gone' when it no longer reaches back", () => {
    const ring = new StreamRing(3);
    expect(ring.since(0)).toEqual([]);
    expect(ring.since(5)).toBe("gone");
    for (let i = 1; i <= 8; i++) ring.push(ev(i));
    expect(ring.lastSeq()).toBe(8);
    expect((ring.since(6) as StreamEvent[]).map((e) => e.seq)).toEqual([7, 8]);
    expect(ring.since(8)).toEqual([]);
    expect(ring.since(2)).toBe("gone");
    expect(STREAM_RING_SIZE).toBeGreaterThan(1000);
  });
});

describe("event batch", () => {
  it("joins partial text of one message and keeps order", () => {
    const batch = new EventBatch();
    const text = (seq: number, t: string, partial: boolean): StreamEvent =>
      ev(seq, "AgentText", { msgId: "m1", text: t, partial }, "a/s1");
    batch.push(text(1, "Hel", true), "droppable");
    batch.push(ev(2), "critical");
    batch.push(text(3, "lo", true), "droppable");
    expect(batch.size()).toBe(2);
    const out = batch.drain();
    expect(out.map((e) => e.seq)).toEqual([2, 3]);
    expect((out[1]?.data as { text: string }).text).toBe("Hello");
    expect(batch.size()).toBe(0);
  });

  it("latest-wins events replace each other; non-critical ones can be dropped", () => {
    const batch = new EventBatch();
    batch.push(ev(1, "GitStatusChanged", { n: 1 }, "a/s1"), "latest-wins");
    batch.push(ev(2, "GitStatusChanged", { n: 2 }, "a/s1"), "latest-wins");
    batch.push(ev(3, "Spinner"), "droppable");
    batch.push(ev(4, "Notice"), "critical");
    expect(batch.size()).toBe(3);
    batch.dropNonCritical((e) => e.type === "Notice");
    expect(batch.drain().map((e) => e.seq)).toEqual([4]);
  });
});

describe("line reader", () => {
  it("splits lines across chunks and skips blank ones", () => {
    const reader = new LineReader();
    expect(reader.push(Buffer.from('{"a":1}\n{"b"'))).toEqual({ ok: true, lines: ['{"a":1}'] });
    expect(reader.push(Buffer.from(":2}\n\n"))).toEqual({ ok: true, lines: ['{"b":2}'] });
  });

  it("refuses a line over the limit, finished or not", () => {
    expect(new LineReader(10).push(Buffer.from(`${"x".repeat(11)}\n`))).toEqual({
      ok: false,
      reason: "too-long",
    });
    expect(new LineReader(10).push(Buffer.from("x".repeat(11)))).toEqual({
      ok: false,
      reason: "too-long",
    });
  });
});

describe("connection name", () => {
  const base = { username: "jake", home: "/home/jake/.craft" };

  it("is \\\\.\\pipe\\craft-<user> on Windows, and CRAFT_PIPE overrides it", () => {
    expect(defaultAddress({ ...base, platform: "win32" })).toBe("\\\\.\\pipe\\craft-jake");
    expect(defaultAddress({ ...base, platform: "win32", override: "mine" })).toBe(
      "\\\\.\\pipe\\mine",
    );
    expect(defaultAddress({ ...base, platform: "win32", override: "\\\\.\\pipe\\x" })).toBe(
      "\\\\.\\pipe\\x",
    );
    expect(defaultAddress({ ...base, platform: "linux", override: "/tmp/s" })).toBe("/tmp/s");
    expect(defaultAddress({ ...base, platform: "linux", override: "" })).toMatch(/daemon\.sock$/);
  });

  it("recognises 'address in use'", () => {
    expect(isAddressInUse(Object.assign(new Error("x"), { code: "EADDRINUSE" }))).toBe(true);
    expect(isAddressInUse(new Error("x"))).toBe(false);
  });
});

describe("token file", () => {
  it("writes a fresh 32-byte token owner-only, and reads the current one", async () => {
    const fs = new MemoryFileSystem();
    const restricted: string[] = [];
    const { log } = memoryLogger();
    const file = new TokenFile({
      fs,
      path: "/h/daemon.token",
      acl: {
        restrict: (p) => {
          restricted.push(p);
          return Promise.resolve();
        },
      },
      log,
    });
    expect(await file.read()).toBeUndefined();
    const first = await file.generate();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.modes.get("/h/daemon.token")).toBe(0o600);
    expect(restricted).toEqual(["/h/daemon.token"]);
    expect(await file.read()).toBe(first);
    expect(await file.generate()).not.toBe(first);
  });

  it("warns, but still starts, when the owner-only step fails", async () => {
    const { log, sink } = memoryLogger();
    const file = new TokenFile({
      fs: new MemoryFileSystem(),
      path: "/h/daemon.token",
      acl: { restrict: () => Promise.reject(new Error("icacls missing")) },
      log,
    });
    expect(await file.generate()).toHaveLength(64);
    expect(sink.lines.find((l) => l.level === "warn")?.error).toBe("icacls missing");
  });

  it("an empty token file counts as no token", async () => {
    const fs = new MemoryFileSystem();
    await fs.writeAtomic("/h/t", "  \n");
    const file = new TokenFile({
      fs,
      path: "/h/t",
      acl: { restrict: () => Promise.resolve() },
      log: memoryLogger().log,
    });
    expect(await file.read()).toBeUndefined();
  });
});

describe("owner-only permission step", () => {
  function runner(code: number): { runner: FileRunner; calls: string[][] } {
    const calls: string[][] = [];
    return {
      calls,
      runner: {
        runFile: (file, args) => {
          calls.push([file, ...args]);
          return Promise.resolve({ code, stdout: "ok", stderr: "denied" });
        },
      },
    };
  }

  it("on Windows runs icacls with inheritance removed and only the user granted", async () => {
    const { runner: r, calls } = runner(0);
    expect(await new OwnerOnlyAcl(r, "jake", "win32").restrict("C:/h/daemon.token")).toBe("ok");
    expect(calls).toEqual([
      ["icacls", "C:/h/daemon.token", "/inheritance:r", "/grant:r", "jake:F"],
    ]);
  });

  it("reports a failing icacls, and does nothing off Windows", async () => {
    await expect(new OwnerOnlyAcl(runner(5).runner, "jake", "win32").restrict("p")).rejects.toThrow(
      /icacls exited 5/,
    );
    const { runner: r, calls } = runner(0);
    expect(await new OwnerOnlyAcl(r, "jake", "linux").restrict("p")).toBe("");
    expect(calls).toEqual([]);
  });
});
