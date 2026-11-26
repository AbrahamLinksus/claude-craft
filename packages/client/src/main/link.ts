import { EventEmitter } from "node:events";
import type { Duplex } from "node:stream";
import {
  CraftError,
  describeError,
  encodeLine,
  snapshotReplySchema,
  type DaemonMessage,
  type ErrorCode,
  type StreamEvent,
  type Reply,
} from "@craft/protocol";
import { clientHandshake, ImpostorError } from "./handshake.ts";
import type { LinkCommand, LinkEvents, LinkState, SnapshotMessage } from "./link-types.ts";
import { MessageReader } from "./message-reader.ts";
import { RetryPolicy } from "./retry-policy.ts";

export interface LinkDeps {
  connect(): Duplex;
  readToken(): Promise<string | undefined>;
  launcher: { ensureRunning(signal: AbortSignal): Promise<void> };
  delay(ms: number, signal: AbortSignal): Promise<void>;
  clientVersion: string;
}

/** The worker said goodbye with a reason (LLD 1.3 `bye`). */
class ByeError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(describeError(code));
    this.name = "ByeError";
    this.code = code;
  }
}

const UPDATED_NOTICE = "Craft was updated: restart the background worker (sessions pause as cryo)";

const NOT_CONNECTED = "Craft is reconnecting to its background worker; try again in a moment";

function errorReply(id: string): Reply {
  return { type: "reply", id, ok: false, error: { code: "INTERNAL", message: NOT_CONNECTED } };
}

/** Client side of the pipe: handshake, snapshot and events, commands, reconnect (LLD 2). */
export class DaemonLink extends EventEmitter<LinkEvents> {
  private readonly deps: LinkDeps;
  private readonly stop = new AbortController();
  private readonly retry = new RetryPolicy();
  private readonly pending = new Map<string, (reply: Reply) => void>();
  private socket: Duplex | undefined;
  private epoch: number | undefined;
  private lastSeq = 0;
  private live = false;
  /** A resync is unanswered or failed: the next connection must bring a full snapshot. */
  private needFull = false;
  private unanswered = 0;
  private workerVersion: string | undefined;
  private nextId = 1;
  private current: LinkState = { status: "connecting" };
  private firstLink: { resolve(): void; reject(e: Error): void } | undefined;

  constructor(deps: LinkDeps) {
    super();
    this.deps = deps;
  }

  state(): LinkState {
    return this.current;
  }

  /** Resolves when the first connection is live; keeps reconnecting after that. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.firstLink = { resolve, reject };
      void this.run();
    });
  }

  send(cmd: LinkCommand): Promise<Reply> {
    const id = `c${String(this.nextId++)}`;
    const socket = this.socket;
    if (socket === undefined || !this.live) return Promise.resolve(errorReply(id));
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      socket.write(encodeLine({ type: "cmd", id, name: cmd.name, args: cmd.args }));
    });
  }

  close(): void {
    this.stop.abort();
    this.socket?.destroy();
    this.firstLink?.reject(new Error("closed"));
    this.firstLink = undefined;
  }

  private stopped(): boolean {
    return this.stop.signal.aborted;
  }

  private setState(next: LinkState): void {
    this.current = next;
    this.emit("state", next);
  }

  private async run(): Promise<void> {
    await this.launch();
    while (!this.stopped()) {
      const failure = await this.attempt();
      if (this.stopped()) return;
      const advice = this.retry.onFailure(failure.impostor);
      const message = advice.nameTaken ? describeError("PIPE_TAKEN") : failure.message;
      this.setState(
        message === undefined ? { status: "reconnecting" } : { status: "reconnecting", message },
      );
      if (advice.relaunch) await this.launch();
      await this.deps.delay(advice.waitMs, this.stop.signal);
    }
  }

  private async launch(): Promise<void> {
    try {
      await this.deps.launcher.ensureRunning(this.stop.signal);
    } catch {
      // the retry loop below keeps trying and the statusline says "reconnecting"
    }
  }

  /** One connection, from dial to close. Resolves with why it ended. */
  private async attempt(): Promise<{ impostor: boolean; message?: string }> {
    const socket = this.deps.connect();
    this.socket = socket;
    this.live = false;
    const reader = new MessageReader(socket);
    try {
      const hello = await clientHandshake({
        write: (line) => socket.write(line),
        reader,
        readToken: () => this.deps.readToken(),
        clientVersion: this.deps.clientVersion,
        resume:
          this.epoch === undefined || this.needFull
            ? undefined
            : { epoch: this.epoch, lastSeq: this.lastSeq },
      });
      this.epoch = hello.epoch;
      this.workerVersion = hello.daemonVersion;
      this.unanswered = 0;
      for (;;) this.dispatch(await reader.next());
    } catch (error) {
      return this.explain(error);
    } finally {
      socket.destroy();
      this.socket = undefined;
      this.live = false;
      this.failPending();
    }
  }

  private explain(error: unknown): { impostor: boolean; message?: string } {
    if (error instanceof ImpostorError) return { impostor: true };
    if (error instanceof ByeError) return { impostor: false, message: error.message };
    return { impostor: false };
  }

  private dispatch(msg: DaemonMessage): void {
    switch (msg.type) {
      case "snapshot":
        this.lastSeq = msg.seq;
        this.needFull = false;
        this.markLive();
        this.emit("snapshot", { seq: msg.seq, state: msg.state });
        return;
      case "events":
        this.applyEvents(msg.items);
        return;
      case "resync":
        void this.resync();
        return;
      case "reply":
        this.pending.get(msg.id)?.(msg);
        this.pending.delete(msg.id);
        return;
      case "bye":
        throw new ByeError(msg.code);
      case "challenge":
        throw new CraftError("PROTOCOL_ERROR");
    }
  }

  private markLive(): void {
    if (this.live) return;
    this.live = true;
    this.retry.onConnected();
    this.setState(
      this.workerVersion === this.deps.clientVersion
        ? { status: "connected" }
        : { status: "connected", message: UPDATED_NOTICE },
    );
    this.firstLink?.resolve();
    this.firstLink = undefined;
  }

  /** Events the link already applied (seq at or below `lastSeq`) are dropped. */
  private applyEvents(items: StreamEvent[]): void {
    const fresh = items.filter((item) => item.seq > this.lastSeq);
    if (fresh.length === 0) return;
    this.lastSeq = fresh[fresh.length - 1]?.seq ?? this.lastSeq;
    this.markLive();
    this.emit("events", fresh);
  }

  /**
   * The full state as of now, for a window that opened late or after a resync.
   * An error reply or a body that is not `{seq, state}` closes the socket, so the
   * reconnect brings a full snapshot.
   */
  async snapshotNow(): Promise<SnapshotMessage | undefined> {
    const socket = this.socket;
    this.needFull = true;
    this.unanswered++;
    const reply = await this.send({ name: "snapshot.get", args: {} });
    const parsed = reply.ok ? snapshotReplySchema.safeParse(reply.data) : undefined;
    if (parsed?.success !== true) {
      socket?.destroy();
      return undefined;
    }
    if (socket === this.socket && --this.unanswered === 0) this.needFull = false;
    return parsed.data;
  }

  private async resync(): Promise<void> {
    const snapshot = await this.snapshotNow();
    if (snapshot === undefined) return;
    this.lastSeq = Math.max(this.lastSeq, snapshot.seq);
    this.emit("snapshot", snapshot);
  }

  private failPending(): void {
    for (const [id, resolve] of this.pending) resolve(errorReply(id));
    this.pending.clear();
  }
}
