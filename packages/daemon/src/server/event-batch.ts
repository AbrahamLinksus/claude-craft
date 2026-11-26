import { latestWinsKey, type Criticality, type StreamEvent } from "@craft/protocol";

interface TextData {
  msgId: string;
  text: string;
  [key: string]: unknown;
}

function partialTextKey(e: StreamEvent): string | undefined {
  if (e.type !== "AgentText") return undefined;
  const d = e.data as { partial?: unknown; msgId?: unknown };
  return d.partial === true ? `text:${e.sid ?? ""}:${String(d.msgId)}` : undefined;
}

/** What the next flush of one connection will send: coalesced, ascending by `seq`. */
export class EventBatch {
  private items: (StreamEvent | undefined)[] = [];
  private readonly keyed = new Map<string, number>();
  private live = 0;

  size(): number {
    return this.live;
  }

  /** Add an event; partial text of one message is concatenated, latest-wins events replace. */
  push(e: StreamEvent, crit: Criticality): void {
    const key = partialTextKey(e) ?? (crit === "latest-wins" ? latestWinsKey(e) : undefined);
    if (key === undefined) {
      this.append(e);
      return;
    }
    const at = this.keyed.get(key);
    const previous = at === undefined ? undefined : this.items[at];
    if (at !== undefined && previous !== undefined) {
      this.items[at] = undefined;
      this.live -= 1;
      this.keyed.set(key, this.items.length);
      this.append(key.startsWith("text:") ? mergeText(previous, e) : e);
      return;
    }
    this.keyed.set(key, this.items.length);
    this.append(e);
  }

  /** Remove every event that is not critical (socket backlog too large). */
  dropNonCritical(isCritical: (e: StreamEvent) => boolean): void {
    this.items = this.items.map((e) => (e !== undefined && isCritical(e) ? e : undefined));
    this.live = this.items.filter((e) => e !== undefined).length;
    this.keyed.clear();
  }

  drain(): StreamEvent[] {
    const out = this.items.filter((e): e is StreamEvent => e !== undefined);
    this.items = [];
    this.keyed.clear();
    this.live = 0;
    return out;
  }

  private append(e: StreamEvent): void {
    this.items.push(e);
    this.live += 1;
  }
}

function mergeText(older: StreamEvent, newer: StreamEvent): StreamEvent {
  const a = older.data as TextData;
  const b = newer.data as TextData;
  return { ...newer, data: { ...b, text: a.text + b.text } };
}
