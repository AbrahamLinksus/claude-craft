import { userInfo } from "node:os";
import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { CRAFT_VERSION } from "../../../protocol/src/index.ts";
import { registerBridge } from "./bridge.ts";
import { fileClientLog } from "./client-log.ts";
import { loadMainConfig } from "./config.ts";
import { DaemonLauncher } from "./launcher.ts";
import { DaemonLink } from "./link.ts";
import { connectPipe, delay, launcherDeps, readTokenFile } from "./node-adapters.ts";
import {
  appPageUrl,
  createWindow,
  isAppPage,
  lockToAppPage,
  type WindowOptions,
} from "./window.ts";

/** The client package folder: this file is built to `out/main/index.mjs`. */
const APP_PATH = join(import.meta.dirname, "..", "..");

/** Every window Craft creates stays on the app's own page (LLD 2.3). */
function lockEveryWindow(): { winOptions: WindowOptions; pageUrl: string } {
  const winOptions = { appPath: APP_PATH, rendererUrl: process.env["CRAFT_RENDERER_URL"] };
  const pageUrl = appPageUrl(winOptions);
  app.on("web-contents-created", (_e, contents) => {
    lockToAppPage(contents, pageUrl);
  });
  return { winOptions, pageUrl };
}

/** Composition root of the client main process: the only place that builds concrete parts. */
async function start(): Promise<void> {
  await app.whenReady();
  const config = loadMainConfig({
    env: process.env,
    platform: process.platform,
    username: userInfo().username,
    appPath: APP_PATH,
  });
  const launcher = new DaemonLauncher(launcherDeps(config));
  const link = new DaemonLink({
    connect: () => connectPipe(config.address),
    readToken: () => readTokenFile(config.tokenPath),
    launcher,
    delay,
    clientVersion: CRAFT_VERSION,
  });
  const { winOptions, pageUrl } = lockEveryWindow();
  let win = createWindow(winOptions);
  registerBridge({
    ipc: ipcMain,
    link,
    trustSender: (url) => isAppPage(url, pageUrl),
    toWindow: (channel, payload) => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    },
    pickFolder: async () => {
      const picked = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
      return picked.canceled ? undefined : picked.filePaths[0];
    },
    log: fileClientLog(join(config.tokenPath, "..", "logs"), () => new Date()),
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) win = createWindow(winOptions);
  });
  app.on("window-all-closed", () => {
    link.close();
    app.quit();
  });
  await link.connect().catch(() => undefined);
}

void start();
