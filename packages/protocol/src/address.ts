export interface AddressInput {
  platform: NodeJS.Platform;
  username: string;
  home: string;
  /** `CRAFT_PIPE`. */
  override?: string | undefined;
}

const PIPE_PREFIX = "\\\\.\\pipe\\";

/** Where the daemon listens and the client dials: one rule for both (LLD 2.3). */
export function daemonAddress(input: AddressInput): string {
  const { platform, username, home, override } = input;
  if (override !== undefined && override !== "") {
    return platform === "win32" && !override.startsWith(PIPE_PREFIX)
      ? PIPE_PREFIX + override
      : override;
  }
  if (platform === "win32") return `${PIPE_PREFIX}craft-${username}`;
  return `${home.replace(/[\\/]+$/, "")}/daemon.sock`;
}
