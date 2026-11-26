import { randomBytes } from "node:crypto";
import type { Logger } from "../log/index.ts";
import type { FileSystem } from "../store/index.ts";

/** Makes a file readable by its owner only (Windows: icacls). */
export interface OwnerOnlyRestrictor {
  restrict(path: string): Promise<unknown>;
}

export interface TokenFileOptions {
  fs: FileSystem;
  path: string;
  acl: OwnerOnlyRestrictor;
  log: Logger;
}

const TOKEN_BYTES = 32;

/** `~/.craft/daemon.token`: 32 random bytes (hex), fresh at every daemon start (LLD 2.3). */
export class TokenFile {
  private readonly opts: TokenFileOptions;

  constructor(opts: TokenFileOptions) {
    this.opts = opts;
  }

  /** Write a new token, owner-only, and return it. */
  async generate(): Promise<string> {
    const token = randomBytes(TOKEN_BYTES).toString("hex");
    await this.opts.fs.writeAtomic(this.opts.path, token, { mode: 0o600 });
    try {
      await this.opts.acl.restrict(this.opts.path);
    } catch (error) {
      this.opts.log.warn("could not restrict daemon.token to the owner", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    return token;
  }

  /** The token of the daemon that is running now, if any. */
  async read(): Promise<string | undefined> {
    const text = await this.opts.fs.readText(this.opts.path);
    const trimmed = text?.trim();
    return trimmed === undefined || trimmed === "" ? undefined : trimmed;
  }
}
