import { CraftError, settingsSchema, type Settings } from "@craft/protocol";
import type { StoreFiles } from "./files.ts";
import type { Store } from "./store.ts";

/** Path segments that would reach an object's prototype instead of a setting. */
const FORBIDDEN_SEGMENTS: ReadonlySet<string> = new Set(["__proto__", "prototype", "constructor"]);

/** Immutable `set` of a dotted path ("sessions.cap") that must already exist in `current`. */
export function withSettingAt(current: Settings, path: string, value: unknown): Settings {
  const keys = path.split(".");
  const reject = (): CraftError => new CraftError("PROTOCOL_ERROR", {}, { setting: path });
  if (keys.some((key) => FORBIDDEN_SEGMENTS.has(key))) throw reject();
  const next = structuredClone(current) as Record<string, unknown>;
  let cursor: Record<string, unknown> = next;
  for (const key of keys.slice(0, -1)) {
    const child = ownObjectAt(cursor, key);
    if (child === undefined) throw reject();
    cursor = child;
  }
  const last = keys[keys.length - 1] ?? "";
  if (last === "schema" || (!Object.hasOwn(cursor, last) && !isOptionalLeaf(keys))) {
    throw reject();
  }
  cursor[last] = value;
  const parsed = settingsSchema.safeParse(next);
  if (!parsed.success) throw reject();
  return parsed.data;
}

/** The plain object stored under `key` on `cursor` itself (never one reached through its prototype). */
function ownObjectAt(
  cursor: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  if (!Object.hasOwn(cursor, key)) return undefined;
  const child = cursor[key];
  if (typeof child !== "object" || child === null || Array.isArray(child)) return undefined;
  return child as Record<string, unknown>;
}

/** Optional leaves that are absent until set (everything else must exist in the defaults). */
function isOptionalLeaf(keys: readonly string[]): boolean {
  return keys.join(".") === "signIn.method";
}

/** The settings file in memory: read at start, written on every change. */
export class SettingsService {
  private readonly store: Store;
  private readonly files: StoreFiles;
  private current: Settings | undefined;
  private readonly listeners: ((s: Settings) => void)[] = [];

  constructor(store: Store, files: StoreFiles) {
    this.store = store;
    this.files = files;
  }

  async init(): Promise<void> {
    this.current = await this.store.load(this.files.settings);
  }

  get(): Settings {
    if (this.current === undefined)
      throw new CraftError("INTERNAL", {}, { why: "settings not loaded" });
    return this.current;
  }

  async set(path: string, value: unknown): Promise<Settings> {
    const next = withSettingAt(this.get(), path, value);
    await this.store.save(this.files.settings, next);
    this.current = next;
    for (const listener of this.listeners) listener(next);
    return next;
  }

  onChange(listener: (s: Settings) => void): void {
    this.listeners.push(listener);
  }
}
