import { duplexPair, type Duplex } from "node:stream";
import {
  CRAFT_VERSION,
  defaultSettings,
  emptyGrammarTable,
  encodeLine,
  parseClientLine,
  proofFor,
  proofsEqual,
  type ClientMessage,
  type DaemonMessage,
  type Snapshot,
  type StreamEvent,
} from "@craft/protocol";

export function emptySnapshot(): Snapshot {
  return {
    sessions: [],
    repos: [],
    grammar: emptyGrammarTable(),
    prompt: { count: 0 },
    panels: {},
    grafts: [],
    settings: defaultSettings(),
    signIn: { method: "claude-login", ready: "unknown" },
  };
}

export interface WorkerOptions {
  token: string;
  epoch?: number;
  /** Prove with a different token (an impostor). */
  proveWith?: string;
  snapshot?: Snapshot;
  onCmd?: (msg: Extract<ClientMessage, { type: "cmd" }>) => DaemonMessage | undefined;
}

/** One scripted worker connection: speaks the daemon side of the handshake. */
export class FakeWorkerConnection {
  readonly client: Duplex;
  readonly received: ClientMessage[] = [];
  private readonly side: Duplex;
  private buffer = "";
  private readonly opts: WorkerOptions;
  private nonce = "";

  constructor(opts: WorkerOptions) {
    this.opts = opts;
    const [client, side] = duplexPair();
    this.client = client;
    this.side = side;
    side.setEncoding("utf8");
    side.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.drain();
    });
  }

  send(msg: DaemonMessage): void {
    if (this.side.writable) this.side.write(encodeLine(msg));
  }

  sendRaw(text: string): void {
    this.side.write(text);
  }

  events(items: StreamEvent[]): void {
    this.send({ type: "events", items });
  }

  /** The worker hangs up. */
  drop(): void {
    this.side.end();
    this.client.destroy();
  }

  private drain(): void {
    for (let at = this.buffer.indexOf("\n"); at >= 0; at = this.buffer.indexOf("\n")) {
      const line = this.buffer.slice(0, at);
      this.buffer = this.buffer.slice(at + 1);
      const parsed = parseClientLine(line);
      if (parsed.ok) void this.handle(parsed.value);
    }
  }

  private async handle(msg: ClientMessage): Promise<void> {
    this.received.push(msg);
    if (msg.type === "hello") {
      this.nonce = "server-nonce";
      this.send({
        type: "challenge",
        daemonVersion: CRAFT_VERSION,
        epoch: this.opts.epoch ?? 1,
        serverNonce: this.nonce,
        proof: await proofFor(this.opts.proveWith ?? this.opts.token, "daemon", msg.clientNonce),
      });
    } else if (msg.type === "auth") {
      const expected = await proofFor(this.opts.token, "client", this.nonce);
      if (!proofsEqual(expected, msg.proof)) {
        this.send({ type: "bye", code: "UNAUTHORIZED", message: "no" });
        return;
      }
      this.send({ type: "snapshot", seq: 0, state: this.opts.snapshot ?? emptySnapshot() });
    } else {
      const custom = this.opts.onCmd?.(msg);
      this.send(custom ?? { type: "reply", id: msg.id, ok: true, data: emptySnapshot() });
    }
  }
}
