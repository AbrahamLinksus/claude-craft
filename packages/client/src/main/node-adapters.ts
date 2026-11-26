import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createConnection } from "node:net";
import type { Duplex } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import type { MainConfig } from "./config.ts";
import type { LauncherDeps } from "./launcher.ts";

/** Dial the pipe. */
export function connectPipe(address: string): Duplex {
  return createConnection(address);
}

export function probePipe(address: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(address);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/** The token of the running worker; undefined while the file is missing or empty. */
export async function readTokenFile(path: string): Promise<string | undefined> {
  try {
    const text = (await readFile(path, "utf8")).trim();
    return text === "" ? undefined : text;
  } catch {
    return undefined;
  }
}

/** Abortable wait; resolves early (without error) when the signal fires. */
export async function delay(ms: number, signal: AbortSignal): Promise<void> {
  try {
    await sleep(ms, undefined, { signal });
  } catch {
    // aborted: the caller checks the signal
  }
}

/** Real launcher parts: `process.execPath` as Node, detached, hidden, no stdio (LLD 2.3). */
export function launcherDeps(config: MainConfig): LauncherDeps {
  return {
    probe: () => probePipe(config.address),
    delay,
    spawnDaemon: () => {
      const child = spawn(process.execPath, [config.daemonEntry], {
        detached: true,
        windowsHide: true,
        stdio: "ignore",
        env: { ...config.env, ELECTRON_RUN_AS_NODE: "1" },
      });
      child.on("error", () => undefined);
      child.unref();
    },
  };
}
