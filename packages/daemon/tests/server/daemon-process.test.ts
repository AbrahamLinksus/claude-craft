import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDaemon, startDaemon, type DaemonHandle } from "../../src/main.ts";
import { OwnerOnlyAcl, ProcessRunner } from "../../src/process/index.ts";
import { sleep } from "../_support/wire-client.ts";

let home = "";
let address = "";
let pipe = "";
const handles: DaemonHandle[] = [];
const SIGNALS = ["uncaughtException", "SIGINT", "SIGTERM"] as const;

function env(): Record<string, string> {
  return { CRAFT_HOME: home, CRAFT_LOG_LEVEL: "warn", CRAFT_PIPE: pipe };
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "craft-proc-"));
  const name = `craft-proc-${randomUUID().slice(0, 8)}`;
  address = process.platform === "win32" ? `\\\\.\\pipe\\${name}` : join(home, "d.sock");
  pipe = process.platform === "win32" ? name : address;
});

afterEach(async () => {
  for (const h of handles.splice(0)) await h.stop();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

/** Runs the process entry as `node main.ts` would, with exit and output captured. */
async function runEntry(): Promise<{ code: number | undefined; out: string; err: string }> {
  const before = SIGNALS.map((s) => process.listeners(s as NodeJS.Signals));
  let out = "";
  let err = "";
  let code: number | undefined;
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    out += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    err += String(chunk);
    return true;
  });
  vi.spyOn(process, "exit").mockImplementation(((c?: number) => {
    code = c;
  }) as typeof process.exit);
  await runDaemon(env());
  for (let i = 0; i < 100 && code === undefined; i++) await sleep(20);
  SIGNALS.forEach((signal, i) => {
    for (const listener of process.listeners(signal as NodeJS.Signals)) {
      if (!before[i]?.includes(listener)) process.off(signal, listener);
    }
  });
  vi.restoreAllMocks();
  return { code, out, err };
}

describe("daemon process entry (G-05, real pipe)", () => {
  it("test_g05_a_second_daemon_start_prints_already_running_and_exits_0", async () => {
    handles.push(await startDaemon(env()));
    const second = await runEntry();
    expect(second.code).toBe(0);
    expect(second.out).toContain("Craft is already running");
  });

  it("test_g05_a_program_that_is_not_craft_owning_the_name_makes_the_daemon_exit_3", async () => {
    const stranger = createServer((socket) => {
      socket.destroy();
    });
    await new Promise<void>((resolve) => stranger.listen(address, resolve));
    try {
      const result = await runEntry();
      expect(result.code).toBe(3);
      expect(result.err).toContain("PIPE_TAKEN");
    } finally {
      await new Promise<void>((resolve) =>
        stranger.close(() => {
          resolve();
        }),
      );
    }
  });

  it("test_g05_daemon_token_is_readable_only_by_the_owner_icacls_output", async () => {
    if (process.platform !== "win32") return; // elsewhere the 0600 file mode does this
    const file = join(home, "daemon.token");
    writeFileSync(file, "x");
    const runner = new ProcessRunner();
    await new OwnerOnlyAcl(runner, process.env["USERNAME"] ?? "", "win32").restrict(file);
    const shown = await runner.runFile("icacls", [file], { timeoutMs: 10_000 });
    const entries = shown.stdout.split(/\r?\n/).filter((l) => /:\(/.test(l));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatch(/:\(F\)/);
    expect(shown.stdout).not.toMatch(/Everyone|BUILTIN\\Users|Authenticated Users/);
  });
});
