import { randomUUID } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PROTOCOL_VERSION,
  encodeLine,
  parseDaemonLine,
  proofFor,
  randomNonce,
  type ClientMessage,
  type DaemonMessage,
} from "../../../protocol/src/index.ts";
import { defaultAddress } from "../../src/server/index.ts";

/** A pipe name nobody else uses (a Windows pipe, or a socket file elsewhere). */
export function uniqueAddress(): string {
  const name = `craft-test-${randomUUID().slice(0, 8)}`;
  return defaultAddress({
    platform: process.platform,
    username: "tester",
    home: tmpdir(),
    override: process.platform === "win32" ? name : join(tmpdir(), `${name}.sock`),
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Test-side client: sends lines, collects the daemon's messages. */
export class WireClient {
  readonly socket: Socket;
  readonly messages: DaemonMessage[] = [];
  closed = false;
  private buffer = "";

  constructor(address: string) {
    this.socket = createConnection(address);
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.drain();
    });
    this.socket.on("error", () => {
      this.closed = true;
    });
    this.socket.on("close", () => {
      this.closed = true;
    });
  }

  send(msg: ClientMessage): void {
    this.socket.write(encodeLine(msg));
  }

  sendRaw(text: string): void {
    this.socket.write(text);
  }

  /** Wait for a message of this type (already received ones count). */
  async waitFor<T extends DaemonMessage["type"]>(
    type: T,
    timeoutMs = 5000,
  ): Promise<Extract<DaemonMessage, { type: T }>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.messages.find((m) => m.type === type);
      if (found !== undefined) return found as Extract<DaemonMessage, { type: T }>;
      if (this.closed || Date.now() > deadline) throw new Error(`no ${type} message arrived`);
      await sleep(10);
    }
  }

  async waitClosed(timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!this.closed) {
      if (Date.now() > deadline) throw new Error("connection did not close");
      await sleep(10);
    }
  }

  /** hello, then auth with the real token. */
  async handshake(token: string, resume?: { epoch: number; lastSeq: number }): Promise<void> {
    const clientNonce = randomNonce();
    this.send({ type: "hello", protocol: PROTOCOL_VERSION, clientVersion: "test", clientNonce });
    const challenge = await this.waitFor("challenge");
    const proof = await proofFor(token, "client", challenge.serverNonce);
    this.send(resume === undefined ? { type: "auth", proof } : { type: "auth", proof, resume });
  }

  destroy(): void {
    this.socket.destroy();
  }

  private drain(): void {
    for (let at = this.buffer.indexOf("\n"); at >= 0; at = this.buffer.indexOf("\n")) {
      const line = this.buffer.slice(0, at);
      this.buffer = this.buffer.slice(at + 1);
      const parsed = parseDaemonLine(line);
      if (parsed.ok) this.messages.push(parsed.value);
    }
  }
}
