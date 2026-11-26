import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { CraftError, type Reply } from "@craft/protocol";
import { CHANNELS } from "../preload/channels.ts";
import type { BridgeCommand, BridgeMessage, LinkState, LogLevel } from "../preload/api.ts";
import type { ClientLog } from "./client-log.ts";
import type { DaemonLink } from "./link.ts";

export interface BridgeOptions {
  ipc: IpcMain;
  link: DaemonLink;
  /** Deliver a message to the window, if one is open. */
  toWindow: (channel: string, payload: unknown) => void;
  pickFolder: () => Promise<string | undefined>;
  log: ClientLog;
  /** True for the app's own page; messages from any other page are refused (LLD 2.3). */
  trustSender: (url: string) => boolean;
}

/** Wires the link to the window: worker messages out, commands and dialogs in (LLD 13.1). */
export function registerBridge(opts: BridgeOptions): void {
  const { ipc, link, toWindow } = opts;
  link.on("snapshot", (m) => {
    toWindow(CHANNELS.message, {
      kind: "snapshot",
      seq: m.seq,
      state: m.state,
    } satisfies BridgeMessage);
  });
  link.on("events", (items) => {
    toWindow(CHANNELS.message, { kind: "events", items } satisfies BridgeMessage);
  });
  link.on("state", (state) => {
    toWindow(CHANNELS.linkState, state);
  });
  const guard = (e: IpcMainEvent | IpcMainInvokeEvent): void => {
    if (!fromAppPage(opts, e)) throw new CraftError("UNAUTHORIZED");
  };
  ipc.handle(CHANNELS.send, (e, cmd: BridgeCommand): Promise<Reply> => {
    guard(e);
    return link.send(cmd);
  });
  ipc.handle(CHANNELS.pickFolder, (e) => {
    guard(e);
    return opts.pickFolder();
  });
  ipc.handle(CHANNELS.ready, (e) => {
    guard(e);
    return pushCurrent(opts);
  });
  ipc.on(CHANNELS.log, (e, entry: { level: LogLevel; message: string }) => {
    if (fromAppPage(opts, e)) opts.log.write(entry.level, entry.message);
  });
}

/** Only the app's own page may use `window.craft`; the frame's address is checked every time. */
function fromAppPage(opts: BridgeOptions, e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const url = (e as Partial<IpcMainInvokeEvent>).senderFrame?.url;
  return url !== undefined && opts.trustSender(url);
}

/** A window that loaded after the worker connected gets the current state and snapshot. */
async function pushCurrent(opts: BridgeOptions): Promise<void> {
  const state: LinkState = opts.link.state();
  opts.toWindow(CHANNELS.linkState, state);
  if (state.status !== "connected") return;
  const snapshot = await opts.link.snapshotNow();
  if (snapshot !== undefined) {
    opts.toWindow(CHANNELS.message, { kind: "snapshot", ...snapshot } satisfies BridgeMessage);
  }
}
