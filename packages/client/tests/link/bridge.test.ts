import { EventEmitter } from "node:events";
import type { IpcMain } from "electron";
import { describe, expect, it, vi } from "vitest";
import { CHANNELS } from "../../src/preload/channels.ts";
import { registerBridge } from "../../src/main/bridge.ts";
import type { ClientLog } from "../../src/main/client-log.ts";
import type { DaemonLink } from "../../src/main/link.ts";
import type { LinkState } from "../../src/main/link-types.ts";
import { emptySnapshot } from "../_support/fake-worker.ts";

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const APP = "file:///craft/out/renderer/index.html";
const appEvent = { senderFrame: { url: APP } };
const foreignEvent = { senderFrame: { url: "https://evil.example/" } };
const nullFrameEvent = { senderFrame: null };

function setup(state: LinkState = { status: "connected" }): {
  link: EventEmitter;
  handlers: Map<string, Handler>;
  sent: { channel: string; payload: unknown }[];
  logged: { level: string; message: string }[];
  picked: { value: string | undefined };
  send: ReturnType<typeof vi.fn>;
} {
  const link = new EventEmitter();
  const handlers = new Map<string, Handler>();
  const sent: { channel: string; payload: unknown }[] = [];
  const logged: { level: string; message: string }[] = [];
  const picked = { value: "C:/work/api" as string | undefined };
  const send = vi.fn(() => Promise.resolve({ type: "reply", id: "c1", ok: true, data: {} }));
  const fakeLink = Object.assign(link, {
    state: () => state,
    send,
    snapshotNow: () => Promise.resolve({ seq: 3, state: emptySnapshot() }),
  });
  const ipc = {
    handle: (channel: string, fn: Handler) => handlers.set(channel, fn),
    on: (channel: string, fn: Handler) => handlers.set(channel, fn),
  } as unknown as IpcMain;
  const log: ClientLog = { write: (level, message) => logged.push({ level, message }) };
  registerBridge({
    ipc,
    link: fakeLink as unknown as DaemonLink,
    toWindow: (channel, payload) => sent.push({ channel, payload }),
    pickFolder: () => Promise.resolve(picked.value),
    log,
    trustSender: (url) => url === APP,
  });
  return { link, handlers, sent, logged, picked, send };
}

describe("bridge between the worker link and the window", () => {
  it("forwards snapshots, events and link state to the window", () => {
    const { link, sent } = setup();
    link.emit("snapshot", { seq: 1, state: emptySnapshot() });
    link.emit("events", [{ seq: 2, ts: "t", type: "Spinner", data: {} }]);
    link.emit("state", { status: "reconnecting" });
    expect(sent.map((s) => s.channel)).toEqual([
      CHANNELS.message,
      CHANNELS.message,
      CHANNELS.linkState,
    ]);
    expect(sent[1]?.payload).toMatchObject({ kind: "events" });
    expect(sent[2]?.payload).toEqual({ status: "reconnecting" });
  });

  it("passes commands to the worker and opens the folder picker for the window", async () => {
    const { handlers, send, picked } = setup();
    const reply = await handlers.get(CHANNELS.send)?.(appEvent, {
      name: "repo.open",
      args: { path: "p" },
    });
    expect(send).toHaveBeenCalledWith({ name: "repo.open", args: { path: "p" } });
    expect(reply).toMatchObject({ ok: true });
    expect(await handlers.get(CHANNELS.pickFolder)?.(appEvent)).toBe("C:/work/api");
    picked.value = undefined;
    expect(await handlers.get(CHANNELS.pickFolder)?.(appEvent)).toBeUndefined();
  });

  it("a window that loads late gets the current link state and the snapshot", async () => {
    const { handlers, sent } = setup({ status: "connected" });
    await handlers.get(CHANNELS.ready)?.(appEvent);
    expect(sent.map((s) => s.channel)).toEqual([CHANNELS.linkState, CHANNELS.message]);
    expect(sent[1]?.payload).toMatchObject({ kind: "snapshot", seq: 3 });
  });

  it("a window that loads while reconnecting only gets the state", async () => {
    const { handlers, sent } = setup({ status: "reconnecting" });
    await handlers.get(CHANNELS.ready)?.(appEvent);
    expect(sent.map((s) => s.channel)).toEqual([CHANNELS.linkState]);
  });

  it("writes the window's log entries to the client log", () => {
    const { handlers, logged } = setup();
    handlers.get(CHANNELS.log)?.(appEvent, { level: "warn", message: "hello" });
    expect(logged).toEqual([{ level: "warn", message: "hello" }]);
  });

  it.each([
    ["a foreign page", foreignEvent],
    ["a frame that is gone", nullFrameEvent],
  ])("refuses send, pickFolder and ready from %s with UNAUTHORIZED", (_name, event) => {
    const { handlers, send, sent } = setup();
    for (const channel of [CHANNELS.send, CHANNELS.pickFolder, CHANNELS.ready]) {
      expect(() => handlers.get(channel)?.(event, { name: "repo.open", args: {} })).toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }) as Error,
      );
    }
    expect(send).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("drops log entries from a foreign page or a missing frame", () => {
    const { handlers, logged } = setup();
    handlers.get(CHANNELS.log)?.(foreignEvent, { level: "warn", message: "spoof" });
    handlers.get(CHANNELS.log)?.(nullFrameEvent, { level: "warn", message: "spoof" });
    expect(logged).toEqual([]);
  });
});
