import { execFile } from "node:child_process";
import { HELPER_TIMEOUT_MS } from "./constants.ts";

/** The OS facts the reaper needs; tests replace it with a fake. */
export interface ProcessProbe {
  /** ISO creation time of each live pid; dead or unreadable pids are absent. */
  creationTimes(pids: readonly number[]): Promise<Map<number, string>>;
  /** Kills the process and everything it started. Resolves false when nothing was killed. */
  killTree(pid: number): Promise<boolean>;
}

function run(file: string, args: readonly string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      file,
      [...args],
      { timeout: HELPER_TIMEOUT_MS, windowsHide: true, ...(env ? { env } : {}) },
      (_error, stdout) => {
        resolve(stdout);
      },
    );
  });
}

function exitsOk(file: string, args: readonly string[]): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(file, [...args], { timeout: HELPER_TIMEOUT_MS, windowsHide: true }, (error) => {
      resolve(error === null);
    });
  });
}

const WIN_SCRIPT = (pids: readonly number[]): string =>
  `Get-Process -Id ${pids.join(",")} -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id)\`t$($_.StartTime.ToUniversalTime().ToString('o'))" }`;

/** `pid<TAB>iso` lines (Windows) or `pid lstart` lines (`ps`) into a map. */
export function parseCreationLines(text: string, platform: NodeJS.Platform): Map<number, string> {
  const out = new Map<number, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = (platform === "win32" ? /^(\d+)\t(.+)$/ : /^\s*(\d+)\s+(.+)$/).exec(line.trim());
    if (m?.[1] === undefined || m[2] === undefined) continue;
    const ms = Date.parse(m[2]);
    if (!Number.isNaN(ms)) out.set(Number(m[1]), new Date(ms).toISOString());
  }
  return out;
}

export class SystemProbe implements ProcessProbe {
  private readonly platform: NodeJS.Platform;

  constructor(platform: NodeJS.Platform) {
    this.platform = platform;
  }

  async creationTimes(pids: readonly number[]): Promise<Map<number, string>> {
    if (pids.length === 0) return new Map();
    const text =
      this.platform === "win32"
        ? await run("powershell.exe", [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            WIN_SCRIPT(pids),
          ])
        : await run("ps", ["-o", "pid=,lstart=", "-p", pids.join(",")], {
            ...process.env,
            LC_ALL: "C",
          });
    return parseCreationLines(text, this.platform);
  }

  killTree(pid: number): Promise<boolean> {
    if (this.platform === "win32") {
      return exitsOk("taskkill", ["/PID", String(pid), "/T", "/F"]);
    }
    try {
      process.kill(-pid, "SIGKILL");
      return Promise.resolve(true);
    } catch {
      return this.killSingle(pid);
    }
  }

  private killSingle(pid: number): Promise<boolean> {
    try {
      process.kill(pid, "SIGKILL");
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }
}
