import type { Duplex } from "node:stream";
import { parseDaemonLine, type DaemonMessage } from "../../../protocol/src/index.ts";
import { LineReader } from "./line-reader.ts";

/** The connection ended, or the worker sent something that is not a message. */
export class LinkClosedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "LinkClosedError";
  }
}

/** Turns a socket into `await next()` over parsed worker messages. */
export class MessageReader {
  private readonly queue: DaemonMessage[] = [];
  private waiting: { resolve: (m: DaemonMessage) => void; reject: (e: Error) => void } | undefined;
  private failure: Error | undefined;
  private readonly lines = new LineReader();

  constructor(socket: Duplex) {
    socket.on("data", (chunk: Buffer) => {
      this.onData(chunk);
    });
    socket.on("error", () => {
      this.fail(new LinkClosedError("connection error"));
    });
    socket.on("close", () => {
      this.fail(new LinkClosedError("connection closed"));
    });
  }

  next(): Promise<DaemonMessage> {
    const message = this.queue.shift();
    if (message !== undefined) return Promise.resolve(message);
    if (this.failure !== undefined) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.waiting = { resolve, reject };
    });
  }

  private onData(chunk: Buffer): void {
    const result = this.lines.push(chunk);
    if (!result.ok) {
      this.fail(new LinkClosedError("line too long"));
      return;
    }
    for (const line of result.lines) {
      const parsed = parseDaemonLine(line);
      if (!parsed.ok) {
        this.fail(new LinkClosedError(parsed.reason));
        return;
      }
      this.deliver(parsed.value);
    }
  }

  private deliver(message: DaemonMessage): void {
    const waiter = this.waiting;
    if (waiter === undefined) {
      this.queue.push(message);
      return;
    }
    this.waiting = undefined;
    waiter.resolve(message);
  }

  private fail(error: Error): void {
    this.failure ??= error;
    const waiter = this.waiting;
    this.waiting = undefined;
    waiter?.reject(this.failure);
  }
}
