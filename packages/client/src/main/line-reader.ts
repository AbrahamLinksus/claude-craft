import { MAX_LINE_BYTES } from "../../../protocol/src/index.ts";

export type LineResult = { ok: true; lines: string[] } | { ok: false };

const NEWLINE = 0x0a;

/** Splits a byte stream into NDJSON lines; a line over 1 MB is refused (LLD 1.3). */
export class LineReader {
  private pending: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): LineResult {
    const buf = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    const lines: string[] = [];
    let start = 0;
    for (let end = buf.indexOf(NEWLINE, start); end >= 0; end = buf.indexOf(NEWLINE, start)) {
      if (end - start > MAX_LINE_BYTES) return { ok: false };
      const text = buf.toString("utf8", start, end).trim();
      if (text !== "") lines.push(text);
      start = end + 1;
    }
    this.pending = buf.subarray(start);
    return this.pending.length > MAX_LINE_BYTES ? { ok: false } : { ok: true, lines };
  }
}
