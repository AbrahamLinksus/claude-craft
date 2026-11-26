import {
  defaultSettings,
  emptyGrammarTable,
  type AnyCommandHandler,
  type SnapshotReply,
  type Snapshot,
} from "@craft/protocol";
import { InMemoryBus } from "../../src/bus/index.ts";
import {
  CommandRouter,
  ConnectionServer,
  SocketTransport,
  TokenFile,
  commands as serverCommands,
  takeSnapshot,
  type StartResult,
} from "../../src/server/index.ts";
import { MemoryFileSystem } from "./memory-fs.ts";
import { ManualClock } from "./manual-clock.ts";
import { memoryLogger, type MemorySink } from "./memory-log.ts";
import { uniqueAddress } from "./wire-client.ts";

export function emptySnapshot(): Snapshot {
  return {
    sessions: [],
    repos: [],
    grammar: emptyGrammarTable(),
    prompt: { count: 0 },
    panels: {},
    grafts: [],
    settings: defaultSettings(),
    signIn: { method: null, ready: "unknown" },
  };
}

export interface TestServer {
  address: string;
  server: ConnectionServer;
  bus: InMemoryBus;
  clock: ManualClock;
  fs: MemoryFileSystem;
  tokenFile: TokenFile;
  router: CommandRouter;
  sink: MemorySink;
  restarts: number;
  result: StartResult;
  token(): Promise<string>;
  stop(): Promise<void>;
}

export interface TestServerOptions {
  address?: string;
  fs?: MemoryFileSystem;
  epoch?: number;
  bus?: InMemoryBus;
  clock?: ManualClock;
  extraCommands?: AnyCommandHandler[];
  /** The state `snapshot.get` and the handshake read (default: empty). */
  state?: () => Snapshot;
  acl?: { restrict(path: string): Promise<unknown> };
}

/** A real server on a real pipe with a memory token file and a manual clock. */
export async function startTestServer(opts: TestServerOptions = {}): Promise<TestServer> {
  const address = opts.address ?? uniqueAddress();
  const clock = opts.clock ?? new ManualClock();
  const fs = opts.fs ?? new MemoryFileSystem();
  const { log, sink } = memoryLogger();
  const bus =
    opts.bus ??
    new InMemoryBus({ clock, hooks: { onError: () => undefined, onLag: () => undefined } });
  const router = new CommandRouter(log);
  const state = { restarts: 0 };
  const read = opts.state ?? emptySnapshot;
  router.register(
    ...serverCommands({
      snapshot: (): SnapshotReply => takeSnapshot(bus, read),
      restart: () => {
        state.restarts += 1;
      },
    }),
    ...(opts.extraCommands ?? []),
  );
  const tokenFile = new TokenFile({
    fs,
    path: "/craft/daemon.token",
    acl: opts.acl ?? { restrict: () => Promise.resolve("") },
    log,
  });
  const server = new ConnectionServer({
    transport: new SocketTransport(address),
    bus,
    snapshot: read,
    router,
    token: tokenFile,
    clock,
    log,
    daemonVersion: "0.0.0",
    epoch: opts.epoch ?? 1,
  });
  const result = await server.start();
  return {
    address,
    server,
    bus,
    clock,
    fs,
    tokenFile,
    router,
    sink,
    get restarts() {
      return state.restarts;
    },
    result,
    token: async () => (await tokenFile.read()) ?? "",
    stop: () => server.stop(),
  };
}
