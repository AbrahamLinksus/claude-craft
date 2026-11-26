import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { encodeLine, type StreamEvent } from "@craft/protocol";
import { clientHandshake, ImpostorError } from "../../src/main/handshake.ts";
import { LinkClosedError, MessageReader } from "../../src/main/message-reader.ts";
import { emptySnapshot } from "../_support/fake-worker.ts";
import { TOKEN, closeLinks, rig, until } from "../_support/link-rig.ts";

afterEach(closeLinks);

describe("daemon link (US-17)", () => {
  it("starts the worker if needed, completes the token handshake and reports connected", async () => {
    const r = rig();
    const snapshots: number[] = [];
    r.link.on("snapshot", (m) => snapshots.push(m.seq));
    expect(r.link.state()).toEqual({ status: "connecting" });
    await r.link.connect();
    expect(r.ensureRunning).toHaveBeenCalledTimes(1);
    expect(r.link.state()).toEqual({ status: "connected" });
    expect(snapshots).toEqual([0]);
    expect(r.workers[0]?.received.map((m) => m.type)).toEqual(["hello", "auth"]);
  });

  it("test_us17_when_the_worker_goes_away_it_shows_reconnecting_and_then_reconnects_with_its_place", async () => {
    const r = rig();
    await r.link.connect();
    const first = r.workers[0];
    first?.events([{ seq: 4, ts: "t", type: "Spinner", data: {} } satisfies StreamEvent]);
    await until(() => r.workers.length === 1 && first?.received.length === 2, "events");
    await new Promise((res) => setTimeout(res, 20));
    first?.drop();
    await until(() => r.states.some((s) => s.status === "reconnecting"), "reconnecting");
    await until(() => r.link.state().status === "connected" && r.workers.length >= 2, "reconnect");
    const statuses = r.states.map((s) => s.status);
    expect(statuses.indexOf("reconnecting")).toBeGreaterThan(statuses.indexOf("connected"));
    const auth = r.workers.at(-1)?.received.find((m) => m.type === "auth");
    expect(auth).toMatchObject({ resume: { epoch: 1, lastSeq: 4 } });
  });

  it("starts the worker again after 10 s of failed attempts", async () => {
    const r = rig({
      connect: () => {
        const s = new PassThrough();
        queueMicrotask(() => s.destroy());
        return s;
      },
    });
    void r.link.connect().catch(() => undefined);
    await until(() => r.ensureRunning.mock.calls.length >= 2, "second launch");
    expect(r.states.at(-1)).toMatchObject({ status: "reconnecting" });
    expect(r.link.state().message).toBeUndefined();
  });

  it("says the connection name is taken when something else keeps answering instead of Craft", async () => {
    const r = rig();
    r.options.next = { proveWith: "someone-elses-token" };
    void r.link.connect().catch(() => undefined);
    await until(
      () => r.states.some((s) => s.message?.includes("Another program is using Craft") === true),
      "name taken message",
    );
    expect(r.link.state().status).toBe("reconnecting");
  });

  it("shows why the worker said goodbye, and reconnects", async () => {
    const r = rig();
    await r.link.connect();
    r.workers[0]?.send({ type: "bye", code: "BUS_LAG", message: "x" });
    await until(
      () => r.states.some((s) => s.message?.includes("falling behind") === true),
      "bye message",
    );
    await until(() => r.workers.length >= 2 && r.link.state().status === "connected", "back");
  });

  it("forwards events and snapshots, and refetches the snapshot on resync", async () => {
    const r = rig();
    const events: number[] = [];
    const snaps: number[] = [];
    r.link.on("events", (items) => events.push(...items.map((e) => e.seq)));
    r.link.on("snapshot", (m) => snaps.push(m.seq));
    await r.link.connect();
    r.workers[0]?.events([{ seq: 9, ts: "t", type: "Spinner", data: {} }]);
    await until(() => events.length === 1, "events");
    r.workers[0]?.send({ type: "resync" });
    await until(() => snaps.length === 2, "second snapshot");
    expect(snaps).toEqual([0, 9]);
  });
});

describe("commands over the link", () => {
  it("sends a command and returns the worker's reply", async () => {
    const r = rig();
    await r.link.connect();
    const reply = await r.link.send({ name: "snapshot.get", args: {} });
    expect(reply).toMatchObject({ type: "reply", ok: true });
  });

  it("answers in plain words when not connected, and when the link drops mid-command", async () => {
    const r = rig();
    const early = await r.link.send({ name: "snapshot.get", args: {} });
    expect(early).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect(early.ok ? "" : early.error.message).toContain("reconnecting");

    r.options.next = {
      onCmd: () => {
        r.workers.at(-1)?.drop();
        return { type: "bye", code: "INTERNAL", message: "" };
      },
    };
    await r.link.connect();
    const lost = await r.link.send({ name: "repo.list", args: {} });
    expect(lost).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
  });

  it("snapshotNow gives nothing when the worker's reply is not a snapshot", async () => {
    const r = rig();
    r.options.next = {
      onCmd: (m) => ({ type: "reply", id: m.id, ok: true, data: { nonsense: true } }),
    };
    await r.link.connect();
    expect(await r.link.snapshotNow()).toBeUndefined();
    r.options.next = {};
  });

  it("snapshotNow gives the snapshot when the worker sends one", async () => {
    const r = rig();
    await r.link.connect();
    expect(await r.link.snapshotNow()).toEqual({ seq: 0, state: emptySnapshot() });
  });

  it("close() ends a connect that has not finished", async () => {
    const r = rig({ connect: () => new PassThrough() });
    const pending = r.link.connect();
    r.link.close();
    await expect(pending).rejects.toThrow("closed");
  });
});

describe("handshake pieces", () => {
  it("a worker that says goodbye instead of a challenge is a closed link", async () => {
    const socket = new PassThrough();
    const reader = new MessageReader(socket);
    socket.write(encodeLine({ type: "bye", code: "UNAUTHORIZED", message: "no" }));
    await expect(
      clientHandshake({
        write: () => undefined,
        reader,
        readToken: () => Promise.resolve(TOKEN),
        clientVersion: "t",
        resume: undefined,
      }),
    ).rejects.toBeInstanceOf(LinkClosedError);
  });

  it("an unreadable token file means the worker cannot be verified", async () => {
    const socket = new PassThrough();
    const reader = new MessageReader(socket);
    socket.write(
      encodeLine({
        type: "challenge",
        daemonVersion: "0",
        epoch: 1,
        serverNonce: "n".repeat(44),
        proof: "p",
      }),
    );
    await expect(
      clientHandshake({
        write: () => undefined,
        reader,
        readToken: () => Promise.resolve(undefined),
        clientVersion: "t",
        resume: undefined,
      }),
    ).rejects.toBeInstanceOf(ImpostorError);
  });

  it("anything but a challenge first is refused", async () => {
    const socket = new PassThrough();
    const reader = new MessageReader(socket);
    socket.write(encodeLine({ type: "resync" }));
    await expect(
      clientHandshake({
        write: () => undefined,
        reader,
        readToken: () => Promise.resolve(TOKEN),
        clientVersion: "t",
        resume: undefined,
      }),
    ).rejects.toThrow(/expected a challenge/);
  });
});
