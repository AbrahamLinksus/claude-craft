import type { Snapshot, SnapshotReply } from "@craft/protocol";
import type { Bus } from "../bus/index.ts";

/**
 * Read the last published `seq` and the state in one synchronous step, so the state holds every
 * event up to `seq` and none after it (US-17). Never `await` between the two reads.
 */
export function takeSnapshot(bus: Pick<Bus, "lastSeq">, read: () => Snapshot): SnapshotReply {
  const seq = bus.lastSeq();
  return { seq, state: read() };
}
