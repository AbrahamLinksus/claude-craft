import { MAX_LINE_BYTES } from "../../../protocol/src/index.ts";

export type LineResult = { ok: true; lines: string[] } | { ok: false; reason: "too-long" };

const NEWLINE = 0x0a;

/** Splits a byte stream into NDJSON lines and refuses any line over 1 MB (LLD 1.3). */
export class LineReader {
  private pending: Buffer = Buffer.alloc(0);
  private readonly max: number;

  constructor(max: number = MAX_LINE_BYTES) {
    this.max = max;
  }

  push(chunk: Buffer): LineResult {
    const buf = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    const lines: string[] = [];
    let start = 0;
    for (let end = buf.indexOf(NEWLINE, start); end >= 0; end = buf.indexOf(NEWLINE, start)) {
      if (end - start > this.max) return { ok: false, reason: "too-long" };
      const text = buf.toString("utf8", start, end).trim();
      if (text !== "") lines.push(text);
      start = end + 1;
    }
    this.pending = buf.subarray(start);
    if (this.pending.length > this.max) return { ok: false, reason: "too-long" };
    return { ok: true, lines };
  }
}
