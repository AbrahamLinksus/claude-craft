import { createServer, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, proofFor, type Reply, type StreamEvent } from "@craft/protocol";
import { ConnectionServer } from "../../src/server/index.ts";
import { ManualClock } from "../_support/manual-clock.ts";
import { startTestServer, type TestServer } from "../_support/test-server.ts";
import { WireClient, sleep } from "../_support/wire-client.ts";

const servers: TestServer[] = [];
const clients: WireClient[] = [];

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

/** A connected, authenticated client that has its first snapshot. */
async function connected(s: TestServer): Promise<WireClient> {
  const c = dial(s.address);
  await c.handshake(await s.token());
  await c.waitFor("snapshot");
  return c;
}

async function ask(c: WireClient, name: string, args: unknown = {}): Promise<Reply> {
  const id = `q${String(c.messages.length)}-${name}`;
  c.send({ type: "cmd", id, name: name as "snapshot.get", args });
  for (let i = 0; i < 300; i++) {
    const found = c.messages.find((m): m is Reply => m.type === "reply" && m.id === id);
    if (found !== undefined) return found;
    await sleep(10);
  }
  throw new Error(`no reply to ${name}`);
}

afterEach(async () => {
  for (const c of clients.splice(0)) c.destroy();
  for (const s of servers.splice(0)) await s.stop();
});

describe("handshake over the real pipe (G-05)", () => {
  it("a client with the token gets the snapshot and can run a command", async () => {
    const s = await boot();
    expect(s.result).toBe("listening");
    const c = await connected(s);
    const snapshot = c.messages.find((m) => m.type === "snapshot");
    expect(snapshot).toMatchObject({ type: "snapshot", seq: 0 });
    const reply = await ask(c, "snapshot.get");
    expect(reply.ok).toBe(true);
  });

  it("the daemon proves the token too: the challenge carries the daemon's proof", async () => {
    const s = await boot({ epoch: 42 });
    const c = dial(s.address);
    c.send({ type: "hello", protocol: PROTOCOL_VERSION, clientVersion: "t", clientNonce: "abc" });
    const challenge = await c.waitFor("challenge");
    expect(challenge.epoch).toBe(42);
    expect(challenge.proof).toBe(await proofFor(await s.token(), "daemon", "abc"));
  });

  it("test_g05_a_client_without_the_token_gets_bye_unauthorized", async () => {
    const s = await boot();
    const c = dial(s.address);
    c.send({ type: "hello", protocol: PROTOCOL_VERSION, clientVersion: "t", clientNonce: "n" });
    const challenge = await c.waitFor("challenge");
    const proof = await proofFor("not-the-token", "client", challenge.serverNonce);
    c.send({ type: "auth", proof });
    const bye = await c.waitFor("bye");
    expect(bye.code).toBe("UNAUTHORIZED");
    expect(bye.message).toContain("could not confirm this connection is yours");
    await c.waitClosed();
    expect(c.messages.some((m) => m.type === "snapshot")).toBe(false);
  });

  it("test_g05_a_client_that_skips_hello_and_sends_a_command_gets_bye_unauthorized", async () => {
    const s = await boot();
    const c = dial(s.address);
    c.send({ type: "cmd", id: "1", name: "snapshot.get", args: {} });
    expect((await c.waitFor("bye")).code).toBe("UNAUTHORIZED");
  });

  it("test_g05_a_silent_client_is_dropped_after_the_handshake_time_limit", async () => {
    const s = await boot();
    const c = dial(s.address);
    await sleep(100);
    s.clock.advance(5_001);
    expect((await c.waitFor("bye")).code).toBe("UNAUTHORIZED");
    await c.waitClosed();
  });

  it("test_g05_a_malformed_line_closes_only_that_connection", async () => {
    const s = await boot();
    const good = await connected(s);
    const bad = dial(s.address);
    bad.sendRaw("this is not json\n");
    expect((await bad.waitFor("bye")).code).toBe("PROTOCOL_ERROR");
    await bad.waitClosed();
    expect(good.closed).toBe(false);
    expect((await ask(good, "snapshot.get")).ok).toBe(true);
    const fresh = await connected(s); // the daemon still accepts new clients
    expect(fresh.closed).toBe(false);
  });

  it("test_g05_a_line_over_1_mb_closes_only_that_connection", async () => {
    const s = await boot();
    const good = await connected(s);
    const bad = dial(s.address);
    bad.sendRaw(`${"x".repeat(1_100_000)}\n`);
    expect((await bad.waitFor("bye")).code).toBe("PROTOCOL_ERROR");
    await bad.waitClosed();
    expect(good.closed).toBe(false);
    expect((await ask(good, "snapshot.get")).ok).toBe(true);
  });

  it("a line over 1 MB with no newline at all is refused too", async () => {
    const s = await boot();
    const bad = dial(s.address);
    bad.sendRaw("y".repeat(1_100_000));
    expect((await bad.waitFor("bye")).code).toBe("PROTOCOL_ERROR");
  });
});

describe("single instance (G-05)", () => {
  it("test_g05_a_second_daemon_on_the_same_name_is_told_already_running", async () => {
    const first = await boot();
    const second = await startTestServer({ address: first.address, fs: first.fs });
    servers.push(second);
    expect(second.result).toBe("already-running");
    // the first daemon is untouched and still serves
    expect((await ask(await connected(first), "snapshot.get")).ok).toBe(true);
  });

  it("test_g05_a_stranger_owning_the_name_is_reported_as_pipe_taken", async () => {
    const first = await boot();
    await first.stop();
    const stranger = createServer((socket) => {
      socket.destroy();
    });
    await new Promise<void>((resolve) => stranger.listen(first.address, resolve));
    try {
      const s = await startTestServer({ address: first.address });
      servers.push(s);
      expect(s.result).toBe("pipe-taken");
    } finally {
      await new Promise<void>((resolve) =>
        stranger.close(() => {
          resolve();
        }),
      );
    }
  });

  it("a stranger that says nothing is judged foreign once the time limit passes", async () => {
    const free = await boot();
    await free.stop();
    const sockets: Socket[] = [];
    const stranger = createServer((socket) => {
      sockets.push(socket);
    });
    await new Promise<void>((resolve) => stranger.listen(free.address, resolve));
    try {
      const clock = new ManualClock();
      const pending = startTestServer({ address: free.address, clock });
      await sleep(200);
      clock.advance(5_001);
      const s = await pending;
      servers.push(s);
      expect(s.result).toBe("pipe-taken");
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) =>
        stranger.close(() => {
          resolve();
        }),
      );
    }
  });
});

describe("stream and catch-up", () => {
  it("batches events every 33 ms for a ready client", async () => {
    const s = await boot();
    const c = await connected(s);
    s.bus.publish({ type: "Notice", data: { level: "info", text: "one" } });
    s.bus.publish({ type: "Notice", data: { level: "info", text: "two" } });
    s.clock.advance(33);
    const events = await c.waitFor("events");
    expect(events.items.map((e: StreamEvent) => e.seq)).toEqual([1, 2]);
  });

  it("test_us17_a_reconnecting_client_gets_what_it_missed, or a fresh snapshot after a new epoch", async () => {
    const s = await boot({ epoch: 7 });
    const first = await connected(s);
    s.bus.publish({ type: "Notice", data: { level: "info", text: "seen" } });
    s.clock.advance(33);
    await first.waitFor("events");
    first.destroy();
    s.bus.publish({ type: "Notice", data: { level: "info", text: "missed" } });
    await s.bus.idle();

    const back = dial(s.address);
    await back.handshake(await s.token(), { epoch: 7, lastSeq: 1 });
    const missed = await back.waitFor("events");
    expect(missed.items.map((e) => e.seq)).toEqual([2]);
    expect(back.messages.some((m) => m.type === "snapshot")).toBe(false);

    const other = dial(s.address);
    await other.handshake(await s.token(), { epoch: 999, lastSeq: 1 });
    expect(await other.waitFor("snapshot")).toMatchObject({ seq: 2 });
  });
});

describe("commands", () => {
  it("replies in plain words for bad args, unbuilt commands and crashes, never a stack", async () => {
    const s = await boot({
      extraCommands: [
        {
          name: "repo.forget",
          run: () => Promise.reject(new Error("secret internals at C:/x/y.ts:12")),
        },
      ],
    });
    const c = await connected(s);
    const badArgs = await ask(c, "snapshot.get", { surprise: true });
    expect(badArgs).toMatchObject({ ok: false, error: { code: "PROTOCOL_ERROR" } });
    const unbuilt = await ask(c, "repo.list");
    expect(unbuilt).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    const crash = await ask(c, "repo.forget", { repoKey: "k" });
    expect(crash).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect(JSON.stringify(crash)).not.toContain("secret internals");
    expect(s.sink.lines.some((l) => l.msg === "command failed")).toBe(true);
  });

  it("an unknown command name is a protocol error that closes the connection", async () => {
    const s = await boot();
    const c = await connected(s);
    c.sendRaw('{"type":"cmd","id":"x","name":"no.such","args":{}}\n');
    expect((await c.waitFor("bye")).code).toBe("PROTOCOL_ERROR");
  });

  it("refuses commands from a client on another protocol version, except daemon.restart", async () => {
    const s = await boot();
    const c = dial(s.address);
    c.send({ type: "hello", protocol: PROTOCOL_VERSION + 1, clientVersion: "t", clientNonce: "n" });
    const challenge = await c.waitFor("challenge");
    c.send({
      type: "auth",
      proof: await proofFor(await s.token(), "client", challenge.serverNonce),
    });
    await c.waitFor("snapshot");
    expect(await ask(c, "snapshot.get")).toMatchObject({
      ok: false,
      error: { code: "PROTOCOL_ERROR" },
    });
    expect((await ask(c, "daemon.restart")).ok).toBe(true);
    expect(s.restarts).toBe(1);
  });

  it("the router refuses to register one command twice", async () => {
    const s = await boot();
    expect(() => {
      s.router.register({ name: "snapshot.get", run: () => Promise.resolve({}) });
    }).toThrow(/registered twice/);
    expect(s.router.names()).toContain("daemon.restart");
  });
});

describe("server lifecycle", () => {
  it("stop closes open connections", async () => {
    const s = await boot();
    const c = await connected(s);
    await s.stop();
    await c.waitClosed();
    expect(s.server).toBeInstanceOf(ConnectionServer);
  });
});
