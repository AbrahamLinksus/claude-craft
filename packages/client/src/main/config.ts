import { homedir } from "node:os";
import { join } from "node:path";
import { daemonAddress } from "@craft/protocol";

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

function craftHome(env: Env): string {
  const override = env["CRAFT_HOME"];
  return override !== undefined && override !== "" ? override : join(homedir(), ".craft");
}

/** Where the pipe, the token and the worker are (LLD 2.3); the address rule is the worker's own. */
export function loadMainConfig(input: ConfigInput): MainConfig {
  const home = craftHome(input.env);
  const entry = input.env["CRAFT_DAEMON_ENTRY"];
  return {
    address: daemonAddress({
      platform: input.platform,
      username: input.username,
      home,
      override: input.env["CRAFT_PIPE"],
    }),
    tokenPath: join(home, "daemon.token"),
    daemonEntry:
      entry !== undefined && entry !== ""
        ? entry
        : join(input.appPath, "..", "daemon", "dist", "main.js"),
    env: input.env,
  };
}
