import { userInfo } from "node:os";
import { pathToFileURL } from "node:url";
import { CRAFT_VERSION, type AnyCommandHandler, type Snapshot } from "../../protocol/src/index.ts";
import * as agent from "./agent/index.ts";
import * as auth from "./auth/index.ts";
import { InMemoryBus, SystemClock, type Bus } from "./bus/index.ts";
import * as eventlog from "./eventlog/index.ts";
import * as git from "./git/index.ts";
import * as grafts from "./grafts/index.ts";
import * as grammar from "./grammar/index.ts";
import * as intercept from "./intercept/index.ts";
import { DailyFileSink, SinkLogger, parseLogLevel, type Logger } from "./log/index.ts";
import * as processModule from "./process/index.ts";
import * as prompts from "./prompts/index.ts";
import * as server from "./server/index.ts";
import * as sessions from "./sessions/index.ts";
import * as store from "./store/index.ts";
import * as undo from "./undo/index.ts";
import * as watchdog from "./watchdog/index.ts";

export type Env = Readonly<Record<string, string | undefined>>;

export interface DaemonHandle {
  /** `listening`, or why this process should exit instead. */
  result: server.StartResult;
  stop(): Promise<void>;
  log: Logger;
}

interface Infra {
  clock: SystemClock;
  log: Logger;
  sink: DailyFileSink;
  bus: Bus;
  paths: store.CraftPaths;
  files: store.StoreFiles;
  fs: store.FileSystem;
  jsonStore: store.JsonStore;
  graftHost: { current: grafts.GraftHost | undefined };
}

/** Logger, bus and store: everything that has no behaviour of its own. */
function buildInfra(env: Env): Infra {
  const clock = new SystemClock();
  const paths = store.craftPaths(store.resolveHome(env));
  const sink = new DailyFileSink(paths.logsDir);
  const log = new SinkLogger({
    sink,
    level: parseLogLevel(env["CRAFT_LOG_LEVEL"]),
    mod: "daemon",
    now: () => clock.now(),
  });
  const graftHost: Infra["graftHost"] = { current: undefined };
  const bus: InMemoryBus = new InMemoryBus({
    clock,
    graftCriticality: (type) => graftHost.current?.eventCriticality(type),
    hooks: {
      onError: (name, error) => {
        log.error("subscriber failed", { subscriber: name, error: String(error) });
      },
      onLag: (name, queued) => {
        log.warn("subscriber is lagging", { subscriber: name, queued });
        bus.publish({
          type: "Notice",
          data: { level: "warn", text: "Craft is falling behind", code: "BUS_LAG" },
        });
      },
    },
  });
  const fs = new store.NodeFileSystem();
  const jsonStore = new store.JsonStore(fs, paths);
  jsonStore.onWarning((w) => {
    log.warn("store file fell back to defaults", { file: w.file });
    bus.publish({ type: "Notice", data: { level: "warn", text: w.message } });
  });
  return { clock, log, sink, bus, paths, files: store.storeFiles(paths), fs, jsonStore, graftHost };
}

interface Services {
  settings: store.SettingsService;
  auth: auth.AuthService;
  prompts: prompts.PromptQueue;
  grammar: grammar.GrammarRegistry;
  sessions: sessions.SessionHost;
  grafts: grafts.GraftHost;
  reaper: processModule.ProcessReaper;
  watchdog: watchdog.Watchdog;
  chain: intercept.InterceptionChain;
  agent: agent.AgentPort;
  undo: undo.UndoJournal;
}

/** Every daemon module, built once, in dependency order. */
async function buildServices(infra: Infra): Promise<Services> {
  const { bus, clock, log, jsonStore, files } = infra;
  const settings = new store.SettingsService(jsonStore, files);
  await settings.init();
  const authService = auth.createAuthService({
    configuredMethod: () => settings.get().signIn.method,
  });
  const promptQueue = prompts.createPromptQueue({ bus });
  const graftHost = grafts.createGraftHost();
  infra.graftHost.current = graftHost;
  const agentPort = agent.createAgentPort();
  const sessionHost = sessions.createSessionHost({
    bus,
    clock,
    log,
    store: jsonStore,
    files,
    settings,
    agent: agentPort,
    auth: authService,
    eventLog: eventlog.createEventLog(),
    prompts: promptQueue,
    git: git.createGit().read,
    workspace: () => graftHost.port("workspace") as sessions.WorkspacePort | undefined,
  });
  return {
    settings,
    auth: authService,
    prompts: promptQueue,
    grammar: grammar.createGrammarRegistry(),
    sessions: sessionHost,
    grafts: graftHost,
    reaper: processModule.createProcessReaper(),
    watchdog: watchdog.createWatchdog(),
    chain: new intercept.InterceptionChain(),
    agent: agentPort,
    undo: undo.createUndoJournal(),
  };
}

function buildSnapshot(s: Services): Snapshot {
  const head = s.prompts.head();
  return {
    sessions: s.sessions.list(),
    repos: s.sessions.repos(),
    grammar: s.grammar.table(),
    prompt: head === undefined ? { count: s.prompts.count() } : { head, count: s.prompts.count() },
    panels: s.grafts.panelStates(),
    grafts: s.grafts.views(),
    settings: s.settings.get(),
    signIn: s.auth.status(),
  };
}

/** Every module's `commands` export, in one list for the router. */
function allCommands(s: Services, serverDeps: server.ServerCommandDeps): AnyCommandHandler[] {
  return [
    ...server.commands(serverDeps),
    ...store.commands(s.settings),
    ...sessions.commands(s.sessions),
    ...auth.commands(s.auth),
    ...prompts.commands(s.prompts),
    ...grammar.commands(s.grammar),
    ...grafts.commands(s.grafts),
    ...agent.commands(),
    ...eventlog.commands(),
    ...git.commands(),
    ...intercept.commands(),
    ...processModule.commands(),
    ...undo.commands(),
    ...watchdog.commands(),
  ];
}

function buildServer(
  infra: Infra,
  s: Services,
  epoch: number,
  restart: () => void,
): server.ConnectionServer {
  const { log, clock, bus, fs, paths } = infra;
  const user = userInfo().username;
  const router = new server.CommandRouter(log);
  const snapshot = (): Snapshot => buildSnapshot(s);
  router.register(...allCommands(s, { snapshot, restart }));
  const address = server.defaultAddress({
    platform: process.platform,
    username: user,
    home: paths.home,
    override: process.env["CRAFT_PIPE"],
  });
  const acl = new processModule.OwnerOnlyAcl(
    new processModule.ProcessRunner(),
    user,
    process.platform,
  );
  return new server.ConnectionServer({
    transport: new server.SocketTransport(address),
    bus,
    snapshot,
    router,
    clock,
    log,
    epoch,
    token: new server.TokenFile({ fs, path: paths.token, acl, log }),
    daemonVersion: CRAFT_VERSION,
    graftCriticality: (type) => s.grafts.eventCriticality(type),
  });
}

/** Recovery, then the graft host, then `DaemonStarted` (LLD 7.3: grafts see recovered sessions). */
async function afterListening(infra: Infra, s: Services, epoch: number): Promise<void> {
  await s.reaper.init();
  const recovered = await s.sessions.recover();
  await infra.jsonStore.save(infra.files.daemonInfo, {
    schema: 1,
    pid: process.pid,
    version: CRAFT_VERSION,
    epoch,
    startedAt: infra.clock.now().toISOString(),
  });
  infra.bus.publish({ type: "DaemonStarted", data: { epoch, recovered } });
  await s.grafts.start();
  s.watchdog.start();
}

/** Build every module and start listening; recovery only runs when this process owns the name. */
export async function startDaemon(
  env: Env,
  onRestart: () => void = () => undefined,
): Promise<DaemonHandle> {
  const infra = buildInfra(env);
  const services = await buildServices(infra);
  const epoch = infra.clock.now().getTime();
  const srv = buildServer(infra, services, epoch, onRestart);
  const result = await srv.start();
  if (result === "listening") await afterListening(infra, services, epoch);
  const stop = async (): Promise<void> => {
    services.watchdog.stop();
    await srv.stop();
    await infra.sink.flush();
  };
  if (result !== "listening") infra.log.info("not starting", { result });
  return { result, stop, log: infra.log };
}

/** Process entry: exit 0 when already running, 3 when a stranger owns the name, 1 on a crash. */
export async function runDaemon(env: Env = process.env): Promise<void> {
  const running: { handle?: DaemonHandle } = {};
  const shutdown = (code: number): void => {
    void (running.handle?.stop() ?? Promise.resolve()).finally(() => process.exit(code));
  };
  process.on("uncaughtException", (error) => {
    running.handle?.log.error("uncaught exception", { error: error.message });
    shutdown(1);
  });
  process.on("SIGINT", () => {
    shutdown(0);
  });
  process.on("SIGTERM", () => {
    shutdown(0);
  });
  let handle: DaemonHandle;
  try {
    handle = await startDaemon(env, () => {
      shutdown(0);
    });
  } catch (error) {
    process.stderr.write(`Craft's background worker could not start: ${String(error)}\n`);
    process.exit(1);
  }
  running.handle = handle;
  if (handle.result === "already-running") {
    process.stdout.write("Craft is already running\n");
    shutdown(0);
  } else if (handle.result === "pipe-taken") {
    process.stderr.write("PIPE_TAKEN: another program is using Craft's connection name\n");
    shutdown(3);
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void runDaemon();
}
