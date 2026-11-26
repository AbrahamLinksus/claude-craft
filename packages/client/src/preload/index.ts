import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { CraftBridge } from "./api.ts";
import { CHANNELS } from "./channels.ts";

function subscribe(channel: string, cb: (value: unknown) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: unknown): void => {
    cb(value);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.off(channel, listener);
  };
}

const craft: CraftBridge = {
  send: (cmd) => ipcRenderer.invoke(CHANNELS.send, cmd) as ReturnType<CraftBridge["send"]>,
  onMessage: (cb) => subscribe(CHANNELS.message, cb as (value: unknown) => void),
  onLinkState: (cb) => subscribe(CHANNELS.linkState, cb as (value: unknown) => void),
  ready: () => ipcRenderer.invoke(CHANNELS.ready) as Promise<void>,
  pickFolder: () => ipcRenderer.invoke(CHANNELS.pickFolder) as Promise<string | undefined>,
  log: (level, message) => {
    ipcRenderer.send(CHANNELS.log, { level, message });
  },
};

contextBridge.exposeInMainWorld("craft", craft);
