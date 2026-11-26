import type { Duplex } from "node:stream";
import type { GraftCriticality, Snapshot } from "@craft/protocol";
import type { Bus } from "../bus/index.ts";
import type { Clock } from "../domain/index.ts";
import type { Logger } from "../log/index.ts";
import { Connection } from "./connection.ts";
import type { CommandRouter } from "./router.ts";
import { probeDaemon } from "./single-instance.ts";
import { StreamRing } from "./stream-ring.ts";
import type { TokenFile } from "./token-file.ts";
import { isAddressInUse, type Transport } from "./transport.ts";

export interface ServerOptions {
  transport: Transport;
  bus: Bus;
  snapshot: () => Snapshot;
  router: CommandRouter;
  token: TokenFile;
  clock: Clock;
  log: Logger;
  daemonVersion: string;
  epoch: number;
  graftCriticality?: GraftCriticality;
}

/** `listening`, or why not: our own daemon already runs (exit 0), or a stranger owns the name (exit 3). */
export type StartResult = "listening" | "already-running" | "pipe-taken";

/** Authenticated pipe connection: handshake, snapshot, batched stream, command intake (LLD 2). */
export class ConnectionServer {
  private readonly o: ServerOptions;
  private readonly ring = new StreamRing();
  private readonly connections = new Set<Connection>();
  private nextId = 0;
  private token: Promise<string> = Promise.reject(new Error("token not ready"));

  constructor(opts: ServerOptions) {
    this.o = opts;
    this.token.catch(() => undefined);
  }

  async start(): Promise<StartResult> {
    this.o.bus.subscribe(
      {},
      (e) => {
        this.ring.push(e);
      },
      { name: "stream-ring", capacity: 1 << 30 },
    );
    let release: (token: string) => void = () => undefined;
    let fail: (error: unknown) => void = () => undefined;
    this.token = new Promise<string>((resolve, reject) => {
      release = resolve;
      fail = reject;
    });
    this.token.catch(() => undefined);
    try {
      await this.o.transport.listen((socket) => {
        this.accept(socket);
      });
    } catch (error) {
      if (!isAddressInUse(error)) throw error;
      return this.whoOwnsTheName();
    }
    try {
      release(await this.o.token.generate());
    } catch (error) {
      fail(error);
      throw error;
    }
    this.o.log.info("listening", { address: this.o.transport.address, epoch: this.o.epoch });
    return "listening";
  }

  async stop(): Promise<void> {
    for (const c of this.connections) c.close();
    await this.o.transport.close();
  }

  private async whoOwnsTheName(): Promise<StartResult> {
    const result = await probeDaemon({
      transport: this.o.transport,
      tokenFile: this.o.token,
      clock: this.o.clock,
    });
    return result === "ours" ? "already-running" : "pipe-taken";
  }

  private accept(socket: Duplex): void {
    this.nextId += 1;
    const conn = new Connection({
      id: String(this.nextId),
      socket,
      token: this.token,
      epoch: this.o.epoch,
      daemonVersion: this.o.daemonVersion,
      ring: this.ring,
      bus: this.o.bus,
      clock: this.o.clock,
      log: this.o.log,
      snapshot: this.o.snapshot,
      router: this.o.router,
      graftCriticality: this.o.graftCriticality,
    });
    this.connections.add(conn);
    socket.on("close", () => {
      this.connections.delete(conn);
    });
    conn.start();
  }
}
