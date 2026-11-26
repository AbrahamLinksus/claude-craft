import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, type WebContents } from "electron";

export interface WindowOptions {
  /** The client package folder; `out/` holds the build. */
  appPath: string;
  /** Dev server address of the renderer, when one is running. */
  rendererUrl: string | undefined;
}

const WINDOW_WIDTH = 1100;
const WINDOW_HEIGHT = 720;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 480;

/** The one window, with the web preferences of LLD 2.3. */
export function createWindow(opts: WindowOptions): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: "Craft",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(opts.appPath, "out", "preload", "index.cjs"),
    },
  });
  if (opts.rendererUrl === undefined) {
    void win.loadFile(join(opts.appPath, "out", "renderer", "index.html"));
  } else {
    void win.loadURL(opts.rendererUrl);
  }
  return win;
}

/** The address of the app's own page: the dev server, or the built file. */
export function appPageUrl(opts: WindowOptions): string {
  return (
    opts.rendererUrl ?? pathToFileURL(join(opts.appPath, "out", "renderer", "index.html")).href
  );
}

/** True only for the app's own page; a hash or query on it is fine. */
export function isAppPage(url: string, pageUrl: string): boolean {
  if (!URL.canParse(url)) return false;
  const target = new URL(url);
  const page = new URL(pageUrl);
  if (page.protocol !== "file:") return target.origin === page.origin;
  return (
    target.protocol === "file:" &&
    target.host === page.host &&
    target.pathname.toLowerCase() === page.pathname.toLowerCase()
  );
}

/** Keeps a window's contents on the app's page: no navigating away, no new windows. */
export function lockToAppPage(contents: WebContents, pageUrl: string): void {
  const stayOnPage = (e: { url: string; preventDefault: () => void }): void => {
    if (!isAppPage(e.url, pageUrl)) e.preventDefault();
  };
  contents.on("will-navigate", stayOnPage);
  contents.on("will-redirect", stayOnPage);
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
}
