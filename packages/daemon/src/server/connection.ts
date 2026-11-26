import { timingSafeEqual } from "node:crypto";
import type { Duplex } from "node:stream";
import {
  HANDSHAKE_TIMEOUT_MS,
  PROTOCOL_VERSION,
  describeError,
  encodeLine,
  parseClientLine,
  proofFor,
  randomNonce,
  type ClientMessage,
  type DaemonMessage,
  type ErrorCode,
  type Snapshot,
} from "@craft/protocol";
import type { Bus } from "../bus/index.ts";
import type { Clock } from "../domain/index.ts";
import type { Logger } from "../log/index.ts";
import { LineReader } from "./line-reader.ts";
import type { CommandRouter } from "./router.ts";
import { takeSnapshot } from "./snapshot.ts";
import { StreamFeed } from "./stream-feed.ts";
import type { StreamRing } from "./stream-ring.ts";

export interface ConnectionOptions {
  id: string;
  socket: Duplex;
  /** Resolves with the token once the daemon has written it. */
  token: Promise<string>;
  epoch: number;
  daemonVersion: string;
  ring: StreamRing;
  bus: Bus;
  clock: Clock;
  log: Logger;
  snapshot: () => Snapshot;
  router: CommandRouter;
  graftCriticality?:
    ((type: string) => "critical" | "latest-wins" | "droppable" | undefined) | undefined;
}

type Phase = "hello" | "auth" | "ready" | "closed";

function sameProof(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** One client socket: handshake, then commands in and the event stream out. */
export class Connection {
  private readonly o: ConnectionOptions;
  private readonly reader = new LineReader();
  private phase: Phase = "hello";
  private chain: Promise<void> = Promise.resolve();
  private serverNonce = "";
  private protocolMatches = true;
  private feed: StreamFeed | undefined;
  private cancelDeadline: (() => void) | undefined;

  constructor(opts: ConnectionOptions) {
    this.o = opts;
  }

  start(): void {
    const socket = this.o.socket;
    socket.on("data", (chunk: Buffer) => {
      this.onData(chunk);
    });
    socket.on("error", () => {
      this.close();
    });
    socket.on("close", () => {
      this.close();
    });
    this.cancelDeadline = this.o.clock.after(HANDSHAKE_TIMEOUT_MS, () => {
      if (this.phase !== "ready") this.bye("UNAUTHORIZED");
    });
  }

  private onData(chunk: Buffer): void {
    if (this.phase === "closed") return;
    const result = this.reader.push(chunk);
    if (!result.ok) {
      this.bye("PROTOCOL_ERROR");
      return;
    }
    for (const line of result.lines) {
      const parsed = parseClientLine(line);
      if (!parsed.ok) {
        this.bye("PROTOCOL_ERROR");
        return;
      }
      this.chain = this.chain
        .then(() => this.handle(parsed.value))
        .catch(() => {
          this.bye("PROTOCOL_ERROR");
        });
    }
  }

  private async handle(msg: ClientMessage): Promise<void> {
    if (this.phase === "closed") return;
    if (msg.type === "hello" && this.phase === "hello") return this.onHello(msg);
    if (msg.type === "auth" && this.phase === "auth") return this.onAuth(msg);
    if (msg.type === "cmd" && this.phase === "ready") return this.onCmd(msg);
    this.bye(this.phase === "ready" ? "PROTOCOL_ERROR" : "UNAUTHORIZED");
  }

  private async onHello(msg: Extract<ClientMessage, { type: "hello" }>): Promise<void> {
    const token = await this.o.token;
    this.protocolMatches = msg.protocol === PROTOCOL_VERSION;
    this.serverNonce = randomNonce();
    this.phase = "auth";
    this.send({
      type: "challenge",
      daemonVersion: this.o.daemonVersion,
      epoch: this.o.epoch,
      serverNonce: this.serverNonce,
      proof: await proofFor(token, "daemon", msg.clientNonce),
    });
  }

  private async onAuth(msg: Extract<ClientMessage, { type: "auth" }>): Promise<void> {
    const expected = await proofFor(await this.o.token, "client", this.serverNonce);
    if (!sameProof(expected, msg.proof)) {
      this.bye("UNAUTHORIZED");
      return;
    }
    this.cancelDeadline?.();
    this.phase = "ready";
    this.o.log.info("client connected", { conn: this.o.id });
    this.startStream(msg.resume);
  }

  private startStream(resume: { epoch: number; lastSeq: number } | undefined): void {
    const missed =
      resume?.epoch === this.o.epoch ? this.o.ring.since(resume.lastSeq) : ("gone" as const);
    const feed = new StreamFeed({
      bus: this.o.bus,
      clock: this.o.clock,
      send: (m) => {
        this.send(m);
      },
      backlog: () => this.o.socket.writableLength,
      graftCriticality: this.o.graftCriticality,
    });
    this.feed = feed;
    if (missed === "gone") {
      const { seq, state } = takeSnapshot(this.o.bus, this.o.snapshot);
      this.send({ type: "snapshot", seq, state });
      feed.start(seq, `conn-${this.o.id}`);
      return;
    }
    const upTo = missed[missed.length - 1]?.seq ?? resume?.lastSeq ?? 0;
    if (missed.length > 0) this.send({ type: "events", items: missed });
    feed.start(upTo, `conn-${this.o.id}`);
  }

  private async onCmd(msg: Extract<ClientMessage, { type: "cmd" }>): Promise<void> {
    if (!this.protocolMatches && msg.name !== "daemon.restart") {
      this.reply(msg.id, { ok: false, error: this.error("PROTOCOL_ERROR") });
      return;
    }
    const result = await this.o.router.dispatch(msg.name, msg.args, { connId: this.o.id });
    this.reply(msg.id, result);
  }

  private error(code: ErrorCode): { code: ErrorCode; message: string } {
    return { code, message: describeError(code) };
  }

  private reply(id: string, result: Awaited<ReturnType<CommandRouter["dispatch"]>>): void {
    this.send(
      result.ok
        ? { type: "reply", id, ok: true, data: result.data }
        : { type: "reply", id, ok: false, error: result.error },
    );
  }

  private send(msg: DaemonMessage): void {
    if (this.phase !== "closed" && this.o.socket.writable) this.o.socket.write(encodeLine(msg));
  }

  /** Send `bye` and close this connection only. */
  bye(code: ErrorCode): void {
    if (this.phase === "closed") return;
    this.send({ type: "bye", code, message: describeError(code) });
    this.o.log.warn("connection closed", { conn: this.o.id, code });
    this.close();
    this.o.socket.end(() => {
      this.o.socket.destroy();
    });
  }

  close(): void {
    this.phase = "closed";
    this.cancelDeadline?.();
    this.feed?.stop();
    this.feed = undefined;
  }
}
