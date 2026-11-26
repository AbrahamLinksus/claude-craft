import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import writeFileAtomic from "write-file-atomic";

export interface WriteOptions {
  /** File mode (POSIX); ignored on Windows, where ACLs apply. */
  mode?: number;
}

/** The store's only door to the disk; tests use a memory fake with the same behaviour. */
export interface FileSystem {
  /** File text, or undefined when the file does not exist. */
  readText(path: string): Promise<string | undefined>;
  /** Atomic replace; creates parent folders. */
  writeAtomic(path: string, data: string, opts?: WriteOptions): Promise<void>;
  /** Names inside a folder; empty when it does not exist. */
  list(dir: string): Promise<string[]>;
  remove(path: string): Promise<void>;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

export class NodeFileSystem implements FileSystem {
  async readText(path: string): Promise<string | undefined> {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  async writeAtomic(path: string, data: string, opts: WriteOptions = {}): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFileAtomic(path, data, opts.mode === undefined ? {} : { mode: opts.mode });
  }

  async list(dir: string): Promise<string[]> {
    try {
      return await readdir(dir);
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  async remove(path: string): Promise<void> {
    await rm(path, { force: true });
  }
}
