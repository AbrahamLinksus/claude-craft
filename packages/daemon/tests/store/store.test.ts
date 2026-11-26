import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CraftError, defaultSettings, type CommandHandler } from "../../../protocol/src/index.ts";
import {
  JsonStore,
  NodeFileSystem,
  SettingsService,
  commands,
  craftPaths,
  resolveHome,
  storeFiles,
  withSettingAt,
  type StoreWarning,
} from "../../src/store/index.ts";
import { MemoryFileSystem } from "../_support/memory-fs.ts";

const fixtureV0 = readFileSync(join(import.meta.dirname, "fixtures", "settings-v0.json"), "utf8");

function setup(
  fs: MemoryFileSystem,
  home = "/craft",
): {
  store: JsonStore;
  files: ReturnType<typeof storeFiles>;
  warnings: StoreWarning[];
  paths: ReturnType<typeof craftPaths>;
} {
  const paths = craftPaths(home);
  const store = new JsonStore(fs, paths);
  const warnings: StoreWarning[] = [];
  store.onWarning((w) => warnings.push(w));
  return { store, files: storeFiles(paths), warnings, paths };
}

describe("store files (LLD 5.1)", () => {
  it("every JSON file has a schema, defaults that satisfy it, and a migration slot", () => {
    const { files } = setup(new MemoryFileSystem());
    const names = [
      "settings",
      "grafts",
      "repoSettings",
      "credentials",
      "repos",
      "undo",
      "children",
      "daemonInfo",
    ] as const;
    for (const name of names) {
      const file = files[name];
      expect(file.version, name).toBe(1);
      expect(Array.isArray(file.migrations), name).toBe(true);
      expect(file.schema.safeParse(file.defaults()).success, name).toBe(true);
    }
    expect(files.credentials.mode).toBe(0o600);
  });

  it("a session record with no file is a bug, not a default", () => {
    const { files } = setup(new MemoryFileSystem());
    expect(() => files.sessionRecord("api", 3).defaults()).toThrow(CraftError);
  });

  it("paths follow the layout and CRAFT_HOME wins over the user folder", () => {
    const paths = craftPaths("/h");
    expect(paths.settings).toBe(join("/h", "config", "settings.json"));
    expect(paths.sessionRecord("api", 3)).toBe(join("/h", "state", "sessions", "api", "s3.json"));
    expect(paths.usageHistory("2026-01")).toBe(join("/h", "usage", "history-2026-01.jsonl"));
    expect(resolveHome({ CRAFT_HOME: "/custom" })).toBe("/custom");
    expect(resolveHome({ CRAFT_HOME: "" })).toMatch(/\.craft$/);
  });
});

describe("persistence (G-02)", () => {
  it("test_g02_a_value_saved_then_read_after_a_restart_is_identical", async () => {
    const fs = new MemoryFileSystem();
    const first = setup(fs);
    const settings = await first.store.load(first.files.settings);
    const changed = { ...settings, sessions: { ...settings.sessions, cap: 7 } };
    await first.store.save(first.files.settings, changed);
    const repos = {
      schema: 1 as const,
      repos: {
        "github.com/a/b": { repoId: "b", path: "C:/b", name: "b", lastOpened: "t", nextN: 4 },
      },
    };
    await first.store.save(first.files.repos, repos);

    const second = setup(fs); // "daemon restart": new objects, same disk
    expect(await second.store.load(second.files.settings)).toEqual(changed);
    expect(await second.store.load(second.files.repos)).toEqual(repos);
  });

  it("test_g02_the_same_on_the_real_disk", async () => {
    const home = mkdtempSync(join(tmpdir(), "craft-store-"));
    try {
      const paths = craftPaths(home);
      const files = storeFiles(paths);
      const a = new JsonStore(new NodeFileSystem(), paths);
      const value = { ...defaultSettings(), signIn: { method: "api-key" as const } };
      await a.save(files.settings, value);
      const b = new JsonStore(new NodeFileSystem(), paths);
      expect(await b.load(files.settings)).toEqual(value);
      expect(existsSync(paths.settings)).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns defaults for a file that does not exist, without a warning", async () => {
    const { store, files, warnings } = setup(new MemoryFileSystem());
    expect(await store.load(files.settings)).toEqual(defaultSettings());
    expect(warnings).toEqual([]);
  });

  it("serializes concurrent saves of one file; the last one wins", async () => {
    const fs = new MemoryFileSystem();
    const { store, files } = setup(fs);
    const base = defaultSettings();
    await Promise.all(
      [1, 2, 3, 4].map((cap) =>
        store.save(files.settings, { ...base, sessions: { ...base.sessions, cap } }),
      ),
    );
    expect((await store.load(files.settings)).sessions.cap).toBe(4);
  });

  it("lists a folder and names the graft data folder", async () => {
    const fs = new MemoryFileSystem();
    const { store, paths } = setup(fs);
    await fs.writeAtomic("/craft/prompts/a.md", "x");
    expect(await store.list("/craft/prompts")).toEqual(["a.md"]);
    expect(store.graftDir("usage")).toBe(paths.graftDataDir("usage"));
  });

  it("the disk file system: missing file, list and remove", async () => {
    const dir = mkdtempSync(join(tmpdir(), "craft-fs-"));
    try {
      const disk = new NodeFileSystem();
      expect(await disk.readText(join(dir, "nope.json"))).toBeUndefined();
      expect(await disk.list(join(dir, "nope"))).toEqual([]);
      await disk.writeAtomic(join(dir, "sub", "a.json"), "{}", { mode: 0o600 });
      expect(await disk.list(join(dir, "sub"))).toEqual(["a.json"]);
      await disk.remove(join(dir, "sub", "a.json"));
      expect(await disk.list(join(dir, "sub"))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("migrations and bad files (G-L2, US-32)", () => {
  it("test_gl2_a_v0_settings_fixture_migrates_keeping_its_values", async () => {
    const fs = new MemoryFileSystem();
    const { store, files, warnings, paths } = setup(fs);
    await fs.writeAtomic(paths.settings, fixtureV0);
    const settings = await store.load(files.settings);
    expect(settings.schema).toBe(1);
    expect(settings.signIn.method).toBe("api-key");
    expect(settings.sessions).toMatchObject({ cap: 3, teamCap: 4, defaultModel: "opus" });
    expect(settings.usage.thresholds).toEqual([50, 80]);
    expect(settings.race.review).toBe(true);
    expect(settings.ui.fleetLayout).toBe("parallel");
    expect(settings.sessions.offlineRetryMinutes).toBe(5); // default fills the rest
    expect(warnings).toEqual([]);
    expect(fs.files.get(paths.settings)).toBe(fixtureV0); // loading never rewrites the file
  });

  it("test_gl2_a_newer_schema_falls_back_to_defaults_with_a_warning_and_is_left_untouched", async () => {
    const fs = new MemoryFileSystem();
    const { store, files, warnings, paths } = setup(fs);
    const newer = JSON.stringify({ schema: 99, sessions: { cap: 2 } });
    await fs.writeAtomic(paths.settings, newer);
    const settings = await store.load(files.settings);
    expect(settings).toEqual(defaultSettings());
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain("settings.json");
    expect(warnings[0]?.message).toContain("newer Craft");
    expect(warnings[0]?.file).toBe(paths.settings);
    expect(fs.files.get(paths.settings)).toBe(newer);
  });

  it("test_gl2_bad_json_falls_back_to_defaults_with_a_warning_and_is_left_untouched", async () => {
    const fs = new MemoryFileSystem();
    const { store, files, warnings, paths } = setup(fs);
    await fs.writeAtomic(paths.settings, "{ not json");
    expect(await store.load(files.settings)).toEqual(defaultSettings());
    expect(warnings[0]?.message).toContain("settings.json is not valid JSON");
    expect(fs.files.get(paths.settings)).toBe("{ not json");
  });

  it("content that does not fit the schema, or has no readable schema number, also falls back", async () => {
    const fs = new MemoryFileSystem();
    const { store, files, warnings, paths } = setup(fs);
    await fs.writeAtomic(paths.settings, JSON.stringify({ schema: 1, sessions: { cap: "many" } }));
    expect(await store.load(files.settings)).toEqual(defaultSettings());
    await fs.writeAtomic(paths.settings, JSON.stringify({ schema: "one" }));
    expect(await store.load(files.settings)).toEqual(defaultSettings());
    await fs.writeAtomic(paths.settings, JSON.stringify([1, 2]));
    expect(await store.load(files.settings)).toEqual(defaultSettings());
    expect(warnings.map((w) => w.message)).toEqual([
      expect.stringContaining("content Craft cannot read"),
      expect.stringContaining("no readable schema number"),
      expect.stringContaining("no readable schema number"),
    ]);
  });

  it("refuses to save a value that breaks the schema", () => {
    const { store, files } = setup(new MemoryFileSystem());
    const broken = { ...defaultSettings(), sessions: { ...defaultSettings().sessions, cap: 0 } };
    expect(() => store.save(files.settings, broken)).toThrow();
  });
});

describe("settings service", () => {
  it("sets a dotted path, saves it, and tells listeners", async () => {
    const fs = new MemoryFileSystem();
    const { store, files } = setup(fs);
    const service = new SettingsService(store, files);
    expect(() => service.get()).toThrow(CraftError);
    await service.init();
    const seen: number[] = [];
    service.onChange((s) => seen.push(s.sessions.cap));
    const handler = commands(service)[0] as CommandHandler<"settings.set">;
    const result = await handler.run({ path: "sessions.cap", value: 9 }, { connId: "1" });
    expect(seen).toEqual([9]);
    expect((result as { sessions: { cap: number } }).sessions.cap).toBe(9);
    expect((await store.load(files.settings)).sessions.cap).toBe(9);
  });

  it("rejects a path that does not exist, a wrong value, or the schema field", () => {
    const base = defaultSettings();
    expect(withSettingAt(base, "signIn.method", "api-key").signIn.method).toBe("api-key");
    for (const [path, value] of [
      ["sessions.nope", 1],
      ["nothing.cap", 1],
      ["sessions.cap", "many"],
      ["schema", 2],
    ] as const) {
      expect(() => withSettingAt(base, path, value), path).toThrow(CraftError);
    }
  });
});

describe("bad file on the real disk", () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "craft-bad-"));
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("is read as defaults and not rewritten", async () => {
    const paths = craftPaths(home);
    mkdirSync(paths.configDir, { recursive: true });
    writeFileSync(paths.settings, "garbage");
    const store = new JsonStore(new NodeFileSystem(), paths);
    expect(await store.load(storeFiles(paths).settings)).toEqual(defaultSettings());
    expect(readFileSync(paths.settings, "utf8")).toBe("garbage");
  });
});
