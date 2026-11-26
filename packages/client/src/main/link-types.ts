import type { CommandName, Snapshot, StreamEvent } from "../../../protocol/src/index.ts";
import type { LinkState } from "../preload/api.ts";

export type { LinkState, LinkStatus } from "../preload/api.ts";

export interface SnapshotMessage {
  seq: number;
  state: Snapshot;
}

export interface LinkEvents {
  snapshot: [SnapshotMessage];
  events: [StreamEvent[]];
  state: [LinkState];
}

export interface LinkCommand {
  name: CommandName;
  args: unknown;
}
