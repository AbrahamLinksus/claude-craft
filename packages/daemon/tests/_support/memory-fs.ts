import type { FileSystem, WriteOptions } from "../../src/store/index.ts";

/** In-memory `FileSystem` with the same behaviour as the disk one (missing file = undefined). */
export class MemoryFileSystem implements FileSystem {
  readonly files = new Map<string, string>();
  readonly modes = new Map<string, number | undefined>();

  readText(path: string): Promise<string | undefined> {
    return Promise.resolve(this.files.get(path));
  }

  writeAtomic(path: string, data: string, opts: WriteOptions = {}): Promise<void> {
    this.files.set(path, data);
    this.modes.set(path, opts.mode);
    return Promise.resolve();
  }

  list(dir: string): Promise<string[]> {
    const prefix = `${dir}/`;
    const names = [...this.files.keys()]
      .filter((p) => p.startsWith(prefix))
      .map((p) => p.slice(prefix.length));
    return Promise.resolve(names);
  }

  remove(path: string): Promise<void> {
    this.files.delete(path);
    return Promise.resolve();
  }
}
