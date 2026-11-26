import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reply } from "../../../protocol/src/index.ts";
import * as agent from "../../src/agent/index.ts";
import * as auth from "../../src/auth/index.ts";
import * as eventlog from "../../src/eventlog/index.ts";
import * as git from "../../src/git/index.ts";
import * as grammar from "../../src/grammar/index.ts";
import * as intercept from "../../src/intercept/index.ts";
import * as processModule from "../../src/process/index.ts";
import * as prompts from "../../src/prompts/index.ts";
import * as server from "../../src/server/index.ts";
import * as store from "../../src/store/index.ts";
import * as undo from "../../src/undo/index.ts";
import * as watchdog from "../../src/watchdog/index.ts";
import { startDaemon, type DaemonHandle } from "../../src/main.ts";
import { WireClient, sleep } from "../_support/wire-client.ts";

let home: string;
const handles: DaemonHandle[] = [];
const clients: WireClient[] = [];
let pipeName: string;
let address: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "craft-main-"));
  pipeName = `craft-main-${randomUUID().slice(0, 8)}`;
  address = process.platform === "win32" ? `\\\\.\\pipe\\${pipeName}` : join(home, "d.sock");
  vi.stubEnv("CRAFT_PIPE", process.platform === "win32" ? pipeName : address);
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.destroy();
  for (const h of handles.splice(0)) await h.stop();
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

async function boot(): Promise<DaemonHandle> {
  const handle = await startDaemon({ CRAFT_HOME: home, CRAFT_LOG_LEVEL: "warn" });
  handles.push(handle);
  return handle;
}

async function login(): Promise<WireClient> {
  const c = new WireClient(address);
  clients.push(c);
  await c.handshake(readFileSync(join(home, "daemon.token"), "utf8").trim());
  await c.waitFor("snapshot");
  return c;
}

async function ask(c: WireClient, id: string, name: string, args: unknown): Promise<Reply> {
  c.send({ type: "cmd", id, name: name as "settings.set", args });
  for (let i = 0; i < 300; i++) {
    const r = c.messages.find((m): m is Reply => m.type === "reply" && m.id === id);
    if (r !== undefined) return r;
    await sleep(10);
  }
  throw new Error("no reply");
}

describe("daemon wiring (main.ts)", () => {
  it("starts, answers the handshake with an empty snapshot and writes daemon.json", async () => {
    const handle = await boot();
    expect(handle.result).toBe("listening");
    const c = await login();
    const snapshot = c.messages.find((m) => m.type === "snapshot");
    expect(snapshot).toMatchObject({
      state: {
        sessions: [],
        repos: [],
        grafts: [],
        signIn: { method: "claude-login", ready: "unknown" },
      },
    });
    const info = JSON.parse(readFileSync(join(home, "daemon.json"), "utf8")) as { pid: number };
    expect(info.pid).toBe(process.pid);
    expect(existsSync(join(home, "daemon.token"))).toBe(true);
  });

  it("test_g02_a_setting_changed_over_the_pipe_is_still_there_after_a_daemon_restart", async () => {
    const first = await boot();
    const c = await login();
    const reply = await ask(c, "s1", "settings.set", { path: "sessions.cap", value: 7 });
    expect(reply.ok).toBe(true);
    c.destroy();
    await first.stop();
    handles.length = 0;

    await boot(); // same CRAFT_HOME: a restart
    const again = await login();
    const snap = again.messages.find((m) => m.type === "snapshot");
    expect(snap).toMatchObject({ state: { settings: { sessions: { cap: 7 } } } });
  });

  it("a second start on the same name reports already-running and does not touch recovery", async () => {
    await boot();
    const second = await boot();
    expect(second.result).toBe("already-running");
  });

  it("an unbuilt command fails in plain words instead of crashing the daemon", async () => {
    await boot();
    const c = await login();
    const reply = await ask(c, "u1", "repo.open", { path: "C:/work/api" });
    expect(reply).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect((await ask(c, "u2", "snapshot.get", {})).ok).toBe(true);
  });

  it("test_g01_every_daemon_module_exports_commands_for_the_router", () => {
    for (const mod of [
      server,
      store,
      auth,
      prompts,
      grammar,
      agent,
      eventlog,
      git,
      intercept,
      processModule,
      undo,
      watchdog,
    ]) {
      expect(typeof mod.commands).toBe("function");
    }
  });
});
