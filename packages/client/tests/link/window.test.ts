import { beforeEach, describe, expect, it, vi } from "vitest";

const created = vi.hoisted(() => ({
  options: undefined as Record<string, unknown> | undefined,
  loadedFile: undefined as string | undefined,
  loadedUrl: undefined as string | undefined,
}));

vi.mock("electron", () => ({
  BrowserWindow: class {
    constructor(options: Record<string, unknown>) {
      created.options = options;
    }
    loadFile(path: string): Promise<void> {
      created.loadedFile = path;
      return Promise.resolve();
    }
    loadURL(url: string): Promise<void> {
      created.loadedUrl = url;
      return Promise.resolve();
    }
  },
}));

import { createWindow } from "../../src/main/window.ts";
import buildConfig from "../../src/main/build.config.ts";

beforeEach(() => {
  created.options = undefined;
  created.loadedFile = undefined;
  created.loadedUrl = undefined;
});

describe("the one window (LLD 2.3 web preferences)", () => {
  it("is sandboxed, isolated, without node, and loads the built page", () => {
    createWindow({ appPath: "C:/craft/client", rendererUrl: undefined });
    const prefs = created.options?.["webPreferences"] as Record<string, unknown>;
    expect(prefs).toMatchObject({ contextIsolation: true, sandbox: true, nodeIntegration: false });
    expect(String(prefs["preload"])).toMatch(/out[\\/]preload[\\/]index\.cjs$/);
    expect(created.loadedFile).toMatch(/out[\\/]renderer[\\/]index\.html$/);
    expect(created.loadedUrl).toBeUndefined();
  });

  it("loads the dev server when one is given", () => {
    createWindow({ appPath: "C:/craft/client", rendererUrl: "http://localhost:8001" });
    expect(created.loadedUrl).toBe("http://localhost:8001");
    expect(created.loadedFile).toBeUndefined();
  });
});

describe("build config", () => {
  const env = { command: "build", mode: "" as string } as const;
  const resolve = (mode: string): Record<string, unknown> =>
    (buildConfig as (e: typeof env) => Record<string, unknown>)({ ...env, mode });

  it("bundles main for Electron's Node with electron left outside", () => {
    const main = resolve("main") as {
      build: { lib: { formats: string[] }; rolldownOptions: { external: string[] } };
    };
    expect(main.build.lib.formats).toEqual(["es"]);
    expect(main.build.rolldownOptions.external).toContain("electron");
  });

  it("bundles the preload as CommonJS, and the window as a normal page build", () => {
    const preload = resolve("preload") as { build: { lib: { formats: string[] } } };
    expect(preload.build.lib.formats).toEqual(["cjs"]);
    const page = resolve("") as { base: string; server: { port: number } };
    expect(page.base).toBe("./");
    expect(page.server.port).toBe(8001);
  });
});
