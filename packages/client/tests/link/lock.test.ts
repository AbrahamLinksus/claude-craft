import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: vi.fn() }));

import type { WebContents } from "electron";
import { appPageUrl, isAppPage, lockToAppPage } from "../../src/main/window.ts";

const FILE_PAGE = appPageUrl({ appPath: "C:/craft/client", rendererUrl: undefined });
const DEV = "http://localhost:8001/";

describe("which address is the app's own page", () => {
  it("the built page is a file URL under out/renderer; the dev server address is used as given", () => {
    expect(FILE_PAGE).toMatch(/^file:\/\/\/.*out\/renderer\/index\.html$/);
    expect(appPageUrl({ appPath: "x", rendererUrl: DEV })).toBe(DEV);
  });

  it("the file page counts, with a hash or another letter case; nothing else does", () => {
    expect(isAppPage(`${FILE_PAGE}#/startup`, FILE_PAGE)).toBe(true);
    expect(isAppPage(FILE_PAGE.toUpperCase().replace("FILE:", "file:"), FILE_PAGE)).toBe(true);
    expect(isAppPage(FILE_PAGE.replace("index.html", "other.html"), FILE_PAGE)).toBe(false);
    const page = "file:///C:/craft/client/out/renderer/index.html";
    expect(isAppPage(page, page)).toBe(true);
    expect(isAppPage("file://otherhost/C:/craft/client/out/renderer/index.html", page)).toBe(false);
    expect(isAppPage("https://evil.example/", FILE_PAGE)).toBe(false);
    expect(isAppPage("not a url", FILE_PAGE)).toBe(false);
  });

  it("in dev mode the same origin counts and another origin does not", () => {
    expect(isAppPage("http://localhost:8001/some/route?x=1", DEV)).toBe(true);
    expect(isAppPage("http://localhost:9999/", DEV)).toBe(false);
    expect(isAppPage("https://evil.example/", DEV)).toBe(false);
    expect(isAppPage(FILE_PAGE, DEV)).toBe(false);
  });
});

type NavEvent = { url: string; preventDefault: () => void };

function fakeContents(): {
  contents: WebContents;
  fire: (event: string, url: string) => boolean;
  openHandler: () => unknown;
} {
  const listeners = new Map<string, (e: NavEvent) => void>();
  let handler: (() => unknown) | undefined;
  const contents = {
    on: (event: string, fn: (e: NavEvent) => void) => listeners.set(event, fn),
    setWindowOpenHandler: (fn: () => unknown) => {
      handler = fn;
    },
  } as unknown as WebContents;
  return {
    contents,
    fire: (event, url) => {
      const preventDefault = vi.fn();
      listeners.get(event)?.({ url, preventDefault });
      return preventDefault.mock.calls.length > 0;
    },
    openHandler: () => handler?.(),
  };
}

describe("a window is locked to the app page", () => {
  it("navigating or redirecting away is cancelled, staying on the page is not", () => {
    const { contents, fire } = fakeContents();
    lockToAppPage(contents, FILE_PAGE);
    expect(fire("will-navigate", "https://evil.example/")).toBe(true);
    expect(fire("will-redirect", "https://evil.example/")).toBe(true);
    expect(fire("will-navigate", `${FILE_PAGE}#/x`)).toBe(false);
    expect(fire("will-redirect", FILE_PAGE)).toBe(false);
  });

  it("window.open is always denied", () => {
    const { contents, openHandler } = fakeContents();
    lockToAppPage(contents, FILE_PAGE);
    expect(openHandler()).toEqual({ action: "deny" });
  });
});
