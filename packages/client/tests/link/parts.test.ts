import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { CraftError, MAX_LINE_BYTES } from "../../../protocol/src/index.ts";
import { fileClientLog } from "../../src/main/client-log.ts";
import { loadMainConfig } from "../../src/main/config.ts";
import { DaemonLauncher, type LauncherDeps } from "../../src/main/launcher.ts";
import { LineReader } from "../../src/main/line-reader.ts";
import { LinkClosedError, MessageReader } from "../../src/main/message-reader.ts";
import {
  connectPipe,
  delay,
  launcherDeps,
  probePipe,
  readTokenFile,
} from "../../src/main/node-adapters.ts";
import { RetryPolicy } from "../../src/main/retry-policy.ts";

const temp: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "craft-client-"));
  temp.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of temp.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("line reader", () => {
  it("splits NDJSON across chunks", () => {
    const r = new LineReader();
    expect(r.push(Buffer.from("a\nb"))).toEqual({ ok: true, lines: ["a"] });
    expect(r.push(Buffer.from("c\n\n"))).toEqual({ ok: true, lines: ["bc"] });
  });

  it("refuses a line over 1 MB", () => {
    expect(new LineReader().push(Buffer.alloc(MAX_LINE_BYTES + 5, 120))).toEqual({ ok: false });
    const full = Buffer.concat([Buffer.alloc(MAX_LINE_BYTES + 5, 120), Buffer.from("\n")]);
    expect(new LineReader().push(full)).toEqual({ ok: false });
  });
});

describe("message reader", () => {
  it("hands over parsed messages in order, whether asked before or after they arrive", async () => {
    const socket = new PassThrough();
    const reader = new MessageReader(socket);
    const early = reader.next();
    socket.write('{"type":"resync"}\n{"type":"resync"}\n');
    expect(await early).toEqual({ type: "resync" });
    expect(await reader.next()).toEqual({ type: "resync" });
  });

  it("fails the waiting reader on junk, on a long line and on close", async () => {
    const junk = new PassThrough();
    const r1 = new MessageReader(junk);
    const waiting = r1.next();
    junk.write("not json\n");
    await expect(waiting).rejects.toBeInstanceOf(LinkClosedError);
    await expect(r1.next()).rejects.toBeInstanceOf(LinkClosedError);

    const big = new PassThrough();
    const r2 = new MessageReader(big);
    big.write(Buffer.alloc(MAX_LINE_BYTES + 10, 120));
    await expect(r2.next()).rejects.toThrow(/too long/);

    const closing = new PassThrough();
    const r3 = new MessageReader(closing);
    const pending = r3.next();
    closing.destroy();
    await expect(pending).rejects.toThrow(/closed/);
  });

  it("reports a socket error as a closed link", async () => {
    const socket = new PassThrough();
    const reader = new MessageReader(socket);
    const pending = reader.next();
    socket.emit("error", new Error("reset"));
    await expect(pending).rejects.toThrow(/connection error/);
  });
});

describe("retry policy (US-17: 'reconnecting' while it retries)", () => {
  it("waits 250 ms, doubling up to 5 s", () => {
    const p = new RetryPolicy();
    const waits = Array.from({ length: 7 }, () => p.onFailure(false).waitMs);
    expect(waits).toEqual([250, 500, 1000, 2000, 4000, 5000, 5000]);
  });

  it("asks to start the worker again after 10 s of failing, then counts afresh", () => {
    const p = new RetryPolicy();
    const relaunches = Array.from({ length: 12 }, () => p.onFailure(false).relaunch);
    expect(relaunches.indexOf(true)).toBe(5); // 250+500+1000+2000+4000+5000 >= 10 s
    // counted afresh after each relaunch: 5 s waits need two failures to reach 10 s again
    expect(relaunches.map((r, i) => (r ? i : -1)).filter((i) => i >= 0)).toEqual([5, 7, 9, 11]);
  });

  it("says the name is taken after 5 impostor answers in a row, and a normal failure resets it", () => {
    const p = new RetryPolicy();
    const flags = Array.from({ length: 5 }, () => p.onFailure(true).nameTaken);
    expect(flags).toEqual([false, false, false, false, true]);
    expect(p.onFailure(false).nameTaken).toBe(false);
    for (let i = 0; i < 3; i++) p.onFailure(true);
    p.onConnected();
    expect(p.onFailure(true)).toMatchObject({ waitMs: 250, nameTaken: false });
  });
});

describe("launcher", () => {
  function deps(running: boolean[]): { d: LauncherDeps; spawned: () => number } {
    let spawned = 0;
    const d: LauncherDeps = {
      probe: () => Promise.resolve(running.shift() ?? false),
      spawnDaemon: () => {
        spawned += 1;
      },
      delay: () => Promise.resolve(),
    };
    return { d, spawned: () => spawned };
  }

  it("does not start a second worker when one answers", async () => {
    const { d, spawned } = deps([true]);
    await new DaemonLauncher(d).ensureRunning();
    expect(spawned()).toBe(0);
  });

  it("starts the worker and waits until it answers", async () => {
    const { d, spawned } = deps([false, false, false, true]);
    await new DaemonLauncher(d).ensureRunning();
    expect(spawned()).toBe(1);
  });

  it("gives up with a plain error when the worker never answers", async () => {
    const { d } = deps([]);
    await expect(new DaemonLauncher(d).ensureRunning()).rejects.toBeInstanceOf(CraftError);
  });

  it("stops waiting when told to stop", async () => {
    const { d } = deps([]);
    const stop = new AbortController();
    stop.abort();
    await expect(new DaemonLauncher(d).ensureRunning(stop.signal)).resolves.toBeUndefined();
  });
});

describe("config (US-17)", () => {
  const base = {
    platform: "win32",
    username: "jake",
    appPath: "C:/craft/packages/client",
  } as const;

  it("uses \\\\.\\pipe\\craft-<user> and ~/.craft by default", () => {
    const c = loadMainConfig({ ...base, env: {} });
    expect(c.address).toBe("\\\\.\\pipe\\craft-jake");
    expect(c.tokenPath).toMatch(/\.craft[\\/]daemon\.token$/);
    expect(c.daemonEntry).toMatch(/daemon[\\/]dist[\\/]main\.js$/);
  });

  it("honours CRAFT_HOME, CRAFT_PIPE and CRAFT_DAEMON_ENTRY", () => {
    const env = { CRAFT_HOME: "D:/h", CRAFT_PIPE: "mine", CRAFT_DAEMON_ENTRY: "D:/w.js" };
    const c = loadMainConfig({ ...base, env });
    expect(c.address).toBe("\\\\.\\pipe\\mine");
    expect(c.tokenPath).toBe(join("D:/h", "daemon.token"));
    expect(c.daemonEntry).toBe("D:/w.js");
    expect(loadMainConfig({ ...base, env: { CRAFT_PIPE: "\\\\.\\pipe\\x" } }).address).toBe(
      "\\\\.\\pipe\\x",
    );
  });

  it("uses a socket file in the home folder off Windows", () => {
    const c = loadMainConfig({ ...base, platform: "linux", env: { CRAFT_HOME: "/h" } });
    expect(c.address).toBe(join("/h", "daemon.sock"));
    expect(loadMainConfig({ ...base, platform: "linux", env: { CRAFT_PIPE: "/s" } }).address).toBe(
      "/s",
    );
  });
});

describe("node adapters", () => {
  function pipeName(): string {
    const name = `craft-client-test-${String(Date.now())}-${String(Math.random()).slice(2, 8)}`;
    return process.platform === "win32" ? `\\\\.\\pipe\\${name}` : join(tmp(), `${name}.sock`);
  }

  it("probes a pipe: true when something answers, false when nothing does", async () => {
    const address = pipeName();
    expect(await probePipe(address)).toBe(false);
    const server = createServer((s) => s.destroy());
    await new Promise<void>((resolve) => server.listen(address, resolve));
    try {
      expect(await probePipe(address)).toBe(true);
      const socket = connectPipe(address);
      await new Promise<void>((resolve) => socket.once("connect", resolve));
      socket.destroy();
    } finally {
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve();
        }),
      );
    }
  });

  it("reads the token, trimmed; missing or empty is 'no token yet'", async () => {
    const dir = tmp();
    expect(await readTokenFile(join(dir, "none"))).toBeUndefined();
    writeFileSync(join(dir, "t"), "abc123\n");
    expect(await readTokenFile(join(dir, "t"))).toBe("abc123");
    writeFileSync(join(dir, "e"), "  \n");
    expect(await readTokenFile(join(dir, "e"))).toBeUndefined();
  });

  it("delay ends early, without error, when aborted", async () => {
    const stop = new AbortController();
    const started = Date.now();
    const waiting = delay(10_000, stop.signal);
    stop.abort();
    await waiting;
    expect(Date.now() - started).toBeLessThan(2000);
    await delay(5, new AbortController().signal);
  });

  it("starts the worker as a separate, detached process that outlives the call", async () => {
    const dir = tmp();
    const marker = join(dir, "started.txt");
    const entry = join(dir, "worker.js");
    writeFileSync(
      entry,
      `require("fs").writeFileSync(${JSON.stringify(marker)}, process.env.CRAFT_MARK + "|" + process.env.ELECTRON_RUN_AS_NODE);`,
    );
    const config = loadMainConfig({
      env: { CRAFT_HOME: dir, CRAFT_MARK: "yes", CRAFT_DAEMON_ENTRY: entry },
      platform: process.platform,
      username: "t",
      appPath: dir,
    });
    launcherDeps(config).spawnDaemon();
    for (let i = 0; i < 100 && !existsSync(marker); i++)
      await delay(50, new AbortController().signal);
    expect(readFileSync(marker, "utf8")).toBe("yes|1");
  });
});

describe("client log", () => {
  it("writes one JSON line per entry into logs/client-<date>.log", async () => {
    const dir = join(tmp(), "logs");
    const log = fileClientLog(dir, () => new Date("2026-03-04T05:06:07Z"));
    log.write("warn", "something small");
    const file = join(dir, "client-2026-03-04.log");
    for (let i = 0; i < 100 && !existsSync(file); i++)
      await delay(20, new AbortController().signal);
    const line = JSON.parse(readFileSync(file, "utf8").trim()) as Record<string, string>;
    expect(line).toMatchObject({ level: "warn", mod: "client", msg: "something small" });
  });
});
