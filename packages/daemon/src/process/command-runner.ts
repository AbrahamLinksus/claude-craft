import { execFile, spawn } from "node:child_process";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs the owner's configured command through the shell (race tests and lint), LLD 6.4. */
export interface CommandRunner {
  run(req: {
    cwd: string;
    cmd: string;
    timeoutMs: number;
    signal?: AbortSignal;
  }): Promise<CommandResult>;
}

/** Runs one executable with an argument array (no shell). */
export interface FileRunner {
  runFile(
    file: string,
    args: readonly string[],
    opts: { timeoutMs: number; signal?: AbortSignal },
  ): Promise<CommandResult>;
}

export class ProcessRunner implements CommandRunner, FileRunner {
  runFile(
    file: string,
    args: readonly string[],
    opts: { timeoutMs: number; signal?: AbortSignal },
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      execFile(
        file,
        [...args],
        {
          timeout: opts.timeoutMs,
          windowsHide: true,
          ...(opts.signal ? { signal: opts.signal } : {}),
        },
        (error, stdout, stderr) => {
          const code = typeof error?.code === "number" ? error.code : error ? 1 : 0;
          resolve({ code, stdout, stderr });
        },
      );
    });
  }

  run(req: {
    cwd: string;
    cmd: string;
    timeoutMs: number;
    signal?: AbortSignal;
  }): Promise<CommandResult> {
    return new Promise((resolve) => {
      const child = spawn(req.cmd, {
        cwd: req.cwd,
        shell: true,
        windowsHide: true,
        timeout: req.timeoutMs,
        ...(req.signal ? { signal: req.signal } : {}),
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      child.on("error", (e) => {
        resolve({ code: 1, stdout, stderr: stderr + e.message });
      });
      child.on("close", (code) => {
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });
  }
}

/** Restricts a file to its owner. Windows: `icacls`; elsewhere the file mode already does it. */
export class OwnerOnlyAcl {
  private readonly runner: FileRunner;
  private readonly user: string;
  private readonly platform: NodeJS.Platform;

  constructor(runner: FileRunner, user: string, platform: NodeJS.Platform) {
    this.runner = runner;
    this.user = user;
    this.platform = platform;
  }

  /** Resolves with the tool output; rejects when `icacls` fails (the caller logs a warning). */
  async restrict(path: string): Promise<string> {
    if (this.platform !== "win32") return "";
    const result = await this.runner.runFile(
      "icacls",
      [path, "/inheritance:r", "/grant:r", `${this.user}:F`],
      { timeoutMs: 10_000 },
    );
    if (result.code !== 0)
      throw new Error(`icacls exited ${String(result.code)}: ${result.stderr}`);
    return result.stdout;
  }
}
