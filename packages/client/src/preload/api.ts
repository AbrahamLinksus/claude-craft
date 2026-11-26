import type { CommandName, Reply, Snapshot, StreamEvent } from "@craft/protocol";

export type LinkStatus = "connecting" | "connected" | "reconnecting";

/** What the statusline shows about the background worker. */
export interface LinkState {
  status: LinkStatus;
  message?: string;
}

/** What the main process forwards from the worker to the window. */
export type BridgeMessage =
  { kind: "snapshot"; seq: number; state: Snapshot } | { kind: "events"; items: StreamEvent[] };

export interface BridgeCommand {
  name: CommandName;
  args: unknown;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

/** `window.craft`: the only way the window talks to anything (LLD 2.3). */
export interface CraftBridge {
  send(cmd: BridgeCommand): Promise<Reply>;
  onMessage(cb: (message: BridgeMessage) => void): () => void;
  onLinkState(cb: (state: LinkState) => void): () => void;
  /** Ask main to push the current link state and snapshot again (window loaded late). */
  ready(): Promise<void>;
  /** Native folder dialog; undefined when cancelled. */
  pickFolder(): Promise<string | undefined>;
  /** Client log forwarding (ids and sizes only, never prompts). */
  log(level: LogLevel, message: string): void;
}
