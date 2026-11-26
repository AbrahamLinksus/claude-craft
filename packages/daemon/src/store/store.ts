import type { ZodType } from "zod";
import type { FileSystem } from "./file-system.ts";
import type { Migration } from "./migrations/registry.ts";
import type { CraftPaths } from "./paths.ts";

/** One file under `CRAFT_HOME`: where it lives and how to read, default and upgrade it. */
export interface StoreFile<T> {
  path: string;
  /** Validates the whole file content including its `schema` field. */
  schema: ZodType<T>;
  /** Current schema version; written as `"schema": version`. */
  version: number;
  defaults: () => T;
  migrations: Migration[];
  /** POSIX mode for new files (credentials). */
  mode?: number;
}

export interface Store {
  /** Invalid, unreadable or newer-than-known files give defaults and a warning; never throws for bad content. */
  load<T>(file: StoreFile<T>): Promise<T>;
  /** Atomic save; one writer per file. */
  save<T>(file: StoreFile<T>, value: T): Promise<void>;
  /** Folder of a graft's own data (`'usage'` is the usage folder). */
  graftDir(graft: string): string;
  /** File names inside a folder (prompts listing); empty when missing. */
  list(dir: string): Promise<string[]>;
  /** Called with a plain sentence naming the file whenever a load falls back to defaults. */
  onWarning(listener: (warning: StoreWarning) => void): void;
}

export interface StoreWarning {
  file: string;
  message: string;
}

function schemaVersionOf(raw: unknown): number | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const v = (raw as { schema?: unknown }).schema;
  if (v === undefined) return 0;
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined;
}

/** The migrated value, or `undefined` when no chain of migrations reaches the current schema. */
function runMigrations(raw: unknown, from: number, file: StoreFile<unknown>): unknown {
  let value = raw;
  let at = from;
  for (const step of file.migrations) {
    if (step.from !== at || step.to > file.version) continue;
    value = step.migrate(value);
    at = step.to;
  }
  if (at !== file.version) return undefined;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return { ...value, schema: file.version };
  }
  return value;
}

export class JsonStore implements Store {
  private readonly fs: FileSystem;
  private readonly paths: CraftPaths;
  private readonly listeners: ((w: StoreWarning) => void)[] = [];
  private readonly writers = new Map<string, Promise<unknown>>();

  constructor(fs: FileSystem, paths: CraftPaths) {
    this.fs = fs;
    this.paths = paths;
  }

  onWarning(listener: (warning: StoreWarning) => void): void {
    this.listeners.push(listener);
  }

  graftDir(graft: string): string {
    return this.paths.graftDataDir(graft);
  }

  list(dir: string): Promise<string[]> {
    return this.fs.list(dir);
  }

  async load<T>(file: StoreFile<T>): Promise<T> {
    let text: string | undefined;
    try {
      text = await this.fs.readText(file.path);
    } catch {
      return this.fallback(file, "could not be read");
    }
    if (text === undefined) return file.defaults();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return this.fallback(file, "is not valid JSON");
    }
    const version = schemaVersionOf(raw);
    if (version === undefined) return this.fallback(file, "has no readable schema number");
    if (version > file.version) {
      return this.fallback(file, `was written by a newer Craft (schema ${String(version)})`);
    }
    const migrated = runMigrations(raw, version, file);
    if (migrated === undefined) {
      return this.fallback(file, `has schema ${String(version)}, which Craft cannot update`);
    }
    const parsed = file.schema.safeParse(migrated);
    return parsed.success ? parsed.data : this.fallback(file, "has content Craft cannot read");
  }

  save<T>(file: StoreFile<T>, value: T): Promise<void> {
    const text = `${JSON.stringify(file.schema.parse(value), null, 2)}\n`;
    const previous = this.writers.get(file.path) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() =>
        this.fs.writeAtomic(file.path, text, file.mode === undefined ? {} : { mode: file.mode }),
      );
    this.writers.set(file.path, next);
    return next;
  }

  private fallback<T>(file: StoreFile<T>, why: string): T {
    const message = `${file.path} ${why}: using defaults, the file is left as it is`;
    for (const listener of this.listeners) listener({ file: file.path, message });
    return file.defaults();
  }
}
