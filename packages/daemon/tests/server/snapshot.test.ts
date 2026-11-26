import { afterEach, describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  clientMessageSchema,
  daemonMessageSchema,
  type DaemonMessage,
  type Reply,
  type Snapshot,
} from "@craft/protocol";
import { takeSnapshot } from "../../src/server/index.ts";
import { emptySnapshot, startTestServer, type TestServer } from "../_support/test-server.ts";
import { WireClient, sleep } from "../_support/wire-client.ts";

const servers: TestServer[] = [];
const clients: WireClient[] = [];

/** Every published event "applies" by raising prompt.count, so the state shows its effect. */
function counting() {
  const applied = { n: 0 };
  const state = (): Snapshot => ({ ...emptySnapshot(), prompt: { count: applied.n } });
  return { applied, state };
}

async function boot(opts: Parameters<typeof startTestServer>[0] = {}): Promise<TestServer> {
  const s = await startTestServer(opts);
  servers.push(s);
  return s;
}

function dial(address: string): WireClient {
  const c = new WireClient(address);
  clients.push(c);
  return c;
}

async function replyTo(c: WireClient, id: string): Promise<Reply> {
  for (let i = 0; i < 300; i++) {
    const found = c.messages.find((m): m is Reply => m.type === "reply" && m.id === id);
    if (found !== undefined) return found;
    await sleep(10);
  }
  throw new Error("no reply");
}

afterEach(async () => {
  for (const c of clients.splice(0)) c.destroy();
  for (const s of servers.splice(0)) await s.stop();
});

describe("snapshot seq (CR-1, US-17)", () => {
  it("takeSnapshot right after bus.publish holds that event's seq and its effect", async () => {
    const s = await boot();
    const { applied, state } = counting();
    const event = s.bus.publish({ type: "Notice", data: { level: "info", text: "x" } });
    applied.n += 1;
    const taken = takeSnapshot(s.bus, state);
    expect(taken.seq).toBe(event.seq);
    expect(taken.state.prompt.count).toBe(1);
  });

  it("snapshot.get right after bus.publish replies {seq, state} with that seq and effect", async () => {
    const counter = counting();
    const s = await boot({ state: counter.state });
    const c = dial(s.address);
    await c.handshake(await s.token());
    await c.waitFor("snapshot");
    const event = s.bus.publish({ type: "Notice", data: { level: "info", text: "x" } });
    counter.applied.n += 1;
    c.send({ type: "cmd", id: "q1", name: "snapshot.get", args: {} });
    const reply = await replyTo(c, "q1");
    expect(reply.ok).toBe(true);
    expect(reply.ok ? reply.data : undefined).toMatchObject({
      seq: event.seq,
      state: { prompt: { count: 1 } },
    });
  });

  it("the handshake snapshot is {seq, state} taken together", async () => {
    const counter = counting();
    const s = await boot({ state: counter.state });
    s.bus.publish({ type: "Notice", data: { level: "info", text: "a" } });
    s.bus.publish({ type: "Notice", data: { level: "info", text: "b" } });
    counter.applied.n = 2;
    const c = dial(s.address);
    await c.handshake(await s.token());
    expect(await c.waitFor("snapshot")).toMatchObject({ seq: 2, state: { prompt: { count: 2 } } });
  });

  it("no event above the reply's seq reaches the socket before the reply", async () => {
    const counter = counting();
    const s = await boot({ state: counter.state });
    const c = dial(s.address);
    await c.handshake(await s.token());
    await c.waitFor("snapshot");
    const publish = (): void => {
      s.bus.publish({ type: "Notice", data: { level: "info", text: "n" } });
      counter.applied.n += 1;
    };
    publish();
    publish();
    c.send({ type: "cmd", id: "q2", name: "snapshot.get", args: {} });
    publish(); // after the command was sent, maybe before it ran
    for (let i = 0; i < 5; i++) {
      s.clock.advance(40);
      await sleep(20);
    }
    const reply = await replyTo(c, "q2");
    const seq = (reply.ok ? reply.data : { seq: -1 }) as { seq: number };
    const order: DaemonMessage[] = c.messages;
    const at = order.findIndex((m) => m.type === "reply" && m.id === "q2");
    for (const m of order.slice(0, at)) {
      if (m.type === "events") for (const e of m.items) expect(e.seq).toBeLessThanOrEqual(seq.seq);
    }
  });
});

describe("strict nonces (CR-1)", () => {
  const hello = (clientNonce: string) =>
    ({ type: "hello", protocol: PROTOCOL_VERSION, clientVersion: "t", clientNonce }) as const;

  it.each([43, 45])(
    "a hello with a %i-char clientNonce is refused, the connection closes, the daemon keeps running",
    async (len) => {
      const s = await boot();
      const bad = dial(s.address);
      bad.sendRaw(`${JSON.stringify(hello("n".repeat(len)))}\n`);
      await bad.waitClosed();
      expect(bad.messages.some((m) => m.type === "challenge")).toBe(false);
      const good = dial(s.address);
      await good.handshake(await s.token());
      expect(await good.waitFor("snapshot")).toMatchObject({ seq: 0 });
    },
  );

  it("the schemas accept 44 chars only, on both sides", () => {
    expect(clientMessageSchema.safeParse(hello("n".repeat(44))).success).toBe(true);
    expect(clientMessageSchema.safeParse(hello("n".repeat(43))).success).toBe(false);
    const challenge = (serverNonce: string) => ({
      type: "challenge",
      daemonVersion: "1",
      epoch: 1,
      serverNonce,
      proof: "p",
    });
    expect(daemonMessageSchema.safeParse(challenge("s".repeat(44))).success).toBe(true);
    expect(daemonMessageSchema.safeParse(challenge("s".repeat(43))).success).toBe(false);
    expect(daemonMessageSchema.safeParse(challenge("s".repeat(45))).success).toBe(false);
  });
});
