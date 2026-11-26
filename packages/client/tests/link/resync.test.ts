import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { encodeLine, type StreamEvent } from "@craft/protocol";
import { clientHandshake } from "../../src/main/handshake.ts";
import { LinkClosedError, MessageReader } from "../../src/main/message-reader.ts";
import { emptySnapshot } from "../_support/fake-worker.ts";
import { TOKEN, closeLinks, rig, until } from "../_support/link-rig.ts";

afterEach(closeLinks);

const UPDATED = "Craft was updated: restart the background worker (sessions pause as cryo)";

function ev(seq: number): StreamEvent {
  return { seq, ts: "t", type: "Spinner", data: {} };
}

describe("resync and snapshot seq (CR-1)", () => {
  it("drops an event the resync snapshot already holds, keeps the ones after it", async () => {
    const r = rig();
    const seen: number[] = [];
    const snaps: number[] = [];
    r.link.on("events", (items) => seen.push(...items.map((e) => e.seq)));
    r.link.on("snapshot", (m) => snaps.push(m.seq));
    r.options.next = {
      onCmd: (m) => ({
        type: "reply",
        id: m.id,
        ok: true,
        data: { seq: 9, state: emptySnapshot() },
      }),
    };
    await r.link.connect();
    r.workers[0]?.send({ type: "resync" });
    await until(() => snaps.length === 2, "resync snapshot");
    r.workers[0]?.events([ev(8), ev(9), ev(10)]);
    await until(() => seen.length > 0, "events");
    expect(seen).toEqual([10]);
  });

  it("two resyncs before a reply never move lastSeq back", async () => {
    const r = rig();
    const ids: string[] = [];
    const seen: number[] = [];
    r.link.on("events", (items) => seen.push(...items.map((e) => e.seq)));
    r.options.next = {
      onCmd: (m) => {
        ids.push(m.id);
        return null;
      },
    };
    await r.link.connect();
    const w = r.workers[0];
    w?.send({ type: "resync" });
    w?.send({ type: "resync" });
    await until(() => ids.length === 2, "both snapshot.get commands");
    const reply = (id: string, seq: number) =>
      w?.send({ type: "reply", id, ok: true, data: { seq, state: emptySnapshot() } });
    reply(ids[1] ?? "", 12);
    reply(ids[0] ?? "", 8); // the older answer arrives last
    await new Promise((res) => setTimeout(res, 30));
    w?.events([ev(11), ev(13)]);
    await until(() => seen.length > 0, "events");
    expect(seen).toEqual([13]);
  });

  it("a reconnect while a resync is unanswered sends auth without resume and gets a full snapshot", async () => {
    const r = rig();
    const snaps: number[] = [];
    r.link.on("snapshot", (m) => snaps.push(m.seq));
    r.options.next = { onCmd: () => null };
    await r.link.connect();
    r.options.next = {};
    const first = r.workers[0];
    first?.events([ev(4)]);
    first?.send({ type: "resync" });
    await until(() => first?.received.some((m) => m.type === "cmd") === true, "resync sent");
    first?.drop();
    await until(() => r.workers.length >= 2 && snaps.length === 2, "full snapshot after reconnect");
    const auth = r.workers[1]?.received.find((m) => m.type === "auth");
    expect(auth).toBeDefined();
    expect(auth).not.toHaveProperty("resume");
  });

  it.each([
    [
      "an error reply",
      (id: string) => ({ type: "reply", id, ok: false, error: { code: "INTERNAL", message: "x" } }),
    ],
    [
      "a bare Snapshot body",
      (id: string) => ({ type: "reply", id, ok: true, data: emptySnapshot() }),
    ],
  ] as const)("%s closes the socket; the reconnect brings a full snapshot", async (_name, make) => {
    const r = rig();
    const snaps: number[] = [];
    r.link.on("snapshot", (m) => snaps.push(m.seq));
    r.options.next = { onCmd: (m) => make(m.id) as never };
    await r.link.connect();
    r.options.next = {};
    r.workers[0]?.events([ev(5)]);
    r.workers[0]?.send({ type: "resync" });
    await until(() => r.workers.length >= 2 && snaps.length === 2, "reconnect snapshot");
    const auth = r.workers[1]?.received.find((m) => m.type === "auth");
    expect(auth).not.toHaveProperty("resume");
  });
});

describe("strict nonces and worker version (CR-1)", () => {
  it("refuses a challenge whose serverNonce is not 44 characters", async () => {
    for (const len of [43, 45]) {
      const socket = new PassThrough();
      const reader = new MessageReader(socket);
      socket.write(
        encodeLine({
          type: "challenge",
          daemonVersion: "0",
          epoch: 1,
          serverNonce: "n".repeat(len),
          proof: "p",
        } as never),
      );
      await expect(
        clientHandshake({
          write: () => undefined,
          reader,
          readToken: () => Promise.resolve(TOKEN),
          clientVersion: "t",
          resume: undefined,
        }),
      ).rejects.toBeInstanceOf(LinkClosedError);
    }
  });

  it("shows the Notice when the worker's version differs from the client's", async () => {
    const r = rig();
    r.options.next = { daemonVersion: "other" };
    await r.link.connect();
    expect(r.link.state()).toEqual({ status: "connected", message: UPDATED });
  });

  it("shows nothing when the versions are equal", async () => {
    const r = rig();
    await r.link.connect();
    expect(r.link.state().message).toBeUndefined();
  });
});
