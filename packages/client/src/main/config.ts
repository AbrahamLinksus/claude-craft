import { homedir } from "node:os";
import { join } from "node:path";

export type Env = Readonly<Record<string, string | undefined>>;

export interface MainConfig {
  /** `\\.\pipe\craft-<user>` (Windows) or `<home>/daemon.sock`. */
  address: string;
  tokenPath: string;
  /** The bundled background worker (`daemon/dist/main.js`). */
  daemonEntry: string;
  env: Env;
}

export interface ConfigInput {
  env: Env;
  platform: NodeJS.Platform;
  username: string;
  /** The client package folder (`app.getAppPath()`). */
  appPath: string;
}

const PIPE_PREFIX = "\\\\.\\pipe\\";

function craftHome(env: Env): string {
  const override = env["CRAFT_HOME"];
  return override !== undefined && override !== "" ? override : join(homedir(), ".craft");
}

function pipeAddress(input: ConfigInput, home: string): string {
  const override = input.env["CRAFT_PIPE"];
  if (override !== undefined && override !== "") {
    return input.platform === "win32" && !override.startsWith(PIPE_PREFIX)
      ? PIPE_PREFIX + override
      : override;
  }
  return input.platform === "win32"
    ? `${PIPE_PREFIX}craft-${input.username}`
    : join(home, "daemon.sock");
}

/** Where the pipe, the token and the worker are (LLD 2.3); same rules as the worker's own. */
export function loadMainConfig(input: ConfigInput): MainConfig {
  const home = craftHome(input.env);
  const entry = input.env["CRAFT_DAEMON_ENTRY"];
  return {
    address: pipeAddress(input, home),
    tokenPath: join(home, "daemon.token"),
    daemonEntry:
      entry !== undefined && entry !== ""
        ? entry
        : join(input.appPath, "..", "daemon", "dist", "main.js"),
    env: input.env,
  };
}
