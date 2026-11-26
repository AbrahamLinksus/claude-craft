import { createConnection, createServer, type Server } from "node:net";
import { join } from "node:path";
import type { Duplex } from "node:stream";

/** Pipe vs Unix socket: the only part of the connection that differs per platform (LLD 2.1). */
export interface Transport {
  readonly address: string;
  /** Rejects with `code: 'EADDRINUSE'` when another program owns the address. */
  listen(onConn: (s: Duplex) => void): Promise<void>;
  /** Dial the address as a client. */
  connect(): Duplex;
  close(): Promise<void>;
}

export interface AddressInput {
  platform: NodeJS.Platform;
  username: string;
  home: string;
  /** `CRAFT_PIPE`. */
  override?: string | undefined;
}

const PIPE_PREFIX = "\\\\.\\pipe\\";

/** `\\.\pipe\craft-<user>` on Windows, `<home>/daemon.sock` elsewhere (LLD 2.3). */
export function defaultAddress(input: AddressInput): string {
  const { platform, username, home, override } = input;
  if (override !== undefined && override !== "") {
    return platform === "win32" && !override.startsWith(PIPE_PREFIX)
      ? PIPE_PREFIX + override
      : override;
  }
  return platform === "win32" ? `${PIPE_PREFIX}craft-${username}` : join(home, "daemon.sock");
}

export function isAddressInUse(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "EADDRINUSE";
}

export class SocketTransport implements Transport {
  readonly address: string;
  private server: Server | undefined;
  private readonly sockets = new Set<Duplex>();

  constructor(address: string) {
    this.address = address;
  }

  listen(onConn: (s: Duplex) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((socket) => {
        this.sockets.add(socket);
        socket.on("close", () => {
          this.sockets.delete(socket);
        });
        onConn(socket);
      });
      server.once("error", reject);
      server.listen(this.address, () => {
        server.off("error", reject);
        this.server = server;
        resolve();
      });
    });
  }

  connect(): Duplex {
    return createConnection(this.address);
  }

  close(): Promise<void> {
    const server = this.server;
    if (server === undefined) return Promise.resolve();
    return new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
      for (const socket of this.sockets) socket.destroy();
    });
  }
}
