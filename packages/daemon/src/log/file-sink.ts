import { appendFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { LogLine, LogSink } from "./logger.ts";

export const LOG_FILES_KEPT = 7;
const FILE_PATTERN = /^daemon-\d{8}\.log$/;

function dayStamp(iso: string): string {
  return iso.slice(0, 10).replaceAll("-", "");
}

/** Appends JSON lines to `<dir>/daemon-YYYYMMDD.log` and keeps the newest 7 files (LLD 16.2). */
export class DailyFileSink implements LogSink {
  private readonly dir: string;
  private pending: Promise<void> = Promise.resolve();
  private pruned = false;

  constructor(dir: string) {
    this.dir = dir;
  }

  write(line: LogLine): void {
    const file = join(this.dir, `daemon-${dayStamp(line.ts)}.log`);
    const text = `${JSON.stringify(line)}\n`;
    this.pending = this.pending.then(() => this.append(file, text)).catch(() => undefined);
  }

  /** Resolves when every line written so far is on disk. */
  flush(): Promise<void> {
    return this.pending;
  }

  private async append(file: string, text: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await appendFile(file, text, "utf8");
    if (!this.pruned) {
      this.pruned = true;
      await this.prune();
    }
  }

  private async prune(): Promise<void> {
    const names = (await readdir(this.dir)).filter((n) => FILE_PATTERN.test(n)).sort();
    const stale = names.slice(0, Math.max(0, names.length - LOG_FILES_KEPT));
    await Promise.all(stale.map((n) => rm(join(this.dir, n), { force: true })));
  }
}
