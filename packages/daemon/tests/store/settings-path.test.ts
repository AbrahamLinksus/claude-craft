import { afterEach, describe, expect, it } from "vitest";
import { CraftError, defaultSettings, describeError } from "../../../protocol/src/index.ts";
import { JsonStore, craftPaths, storeFiles, withSettingAt } from "../../src/store/index.ts";
import { MemoryFileSystem } from "../_support/memory-fs.ts";

const PROTOCOL_TEXT = describeError("PROTOCOL_ERROR");
const toStringOf = (): unknown =>
  Object.getOwnPropertyDescriptor(Object.prototype, "toString")?.value;
const nativeToString = toStringOf();

afterEach(() => {
  expect(toStringOf()).toBe(nativeToString);
  expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
});

describe("settings paths cannot reach an object's prototype (LLD 16.1)", () => {
  it("__proto__ paths throw the fixed protocol message and leave Object.prototype alone", () => {
    const call = (): unknown => withSettingAt(defaultSettings(), "__proto__.toString", "x");
    expect(call).toThrow(CraftError);
    expect(call).toThrow(PROTOCOL_TEXT);
    expect(() => withSettingAt(defaultSettings(), "__proto__.polluted", true)).toThrow(CraftError);
  });

  it.each([
    "constructor.prototype.polluted",
    "sessions.constructor",
    "prototype",
    "toString",
    "hasOwnProperty.x",
    "sessions.__proto__.polluted",
  ])("%s is rejected with the protocol message", (path) => {
    expect(() => withSettingAt(defaultSettings(), path, "x")).toThrow(PROTOCOL_TEXT);
  });

  it("a real setting still changes, without touching the original", () => {
    const before = defaultSettings();
    const next = withSettingAt(before, "sessions.cap", 7);
    expect(next.sessions.cap).toBe(7);
    expect(before.sessions.cap).not.toBe(7);
  });
});

describe("store fallbacks", () => {
  it("a file with a schema number nobody can migrate falls back with a warning", async () => {
    const fs = new MemoryFileSystem();
    const paths = craftPaths("/craft");
    const files = storeFiles(paths);
    const original = JSON.stringify({ schema: 0, junk: true });
    fs.files.set(files.grafts.path, original);
    const store = new JsonStore(fs, paths);
    const warnings: string[] = [];
    store.onWarning((w) => warnings.push(w.message));
    const loaded = await store.load(files.grafts);
    expect(loaded).toEqual(files.grafts.defaults());
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("which Craft cannot update");
    expect(fs.files.get(files.grafts.path)).toBe(original);
  });

  it("a file that cannot be read falls back with a warning instead of crashing", async () => {
    class Unreadable extends MemoryFileSystem {
      override readText(): Promise<string | undefined> {
        return Promise.reject(Object.assign(new Error("denied"), { code: "EACCES" }));
      }
    }
    const paths = craftPaths("/craft");
    const files = storeFiles(paths);
    const store = new JsonStore(new Unreadable(), paths);
    const warnings: string[] = [];
    store.onWarning((w) => warnings.push(w.message));
    expect(await store.load(files.settings)).toEqual(files.settings.defaults());
    expect(warnings[0]).toContain("could not be read");
  });
});
