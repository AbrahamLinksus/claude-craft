export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

/** Extra fields of a log line: ids and sizes only, never keys, prompts or tool output. */
export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(msg: string, kv?: LogFields): void;
  info(msg: string, kv?: LogFields): void;
  warn(msg: string, kv?: LogFields): void;
  error(msg: string, kv?: LogFields): void;
  /** Same sink, `mod` set to `mod` on every line. */
  child(mod: string): Logger;
}

export interface LogLine {
  ts: string;
  level: LogLevel;
  mod: string;
  msg: string;
  [key: string]: unknown;
}

export function parseLogLevel(value: string | undefined): LogLevel {
  const found = LOG_LEVELS.find((l) => l === value?.toLowerCase());
  return found ?? "info";
}

/** Receives finished lines; the file writer and the test memory sink implement it. */
export interface LogSink {
  write(line: LogLine): void;
}

export class SinkLogger implements Logger {
  private readonly sink: LogSink;
  private readonly minLevel: LogLevel;
  private readonly mod: string;
  private readonly now: () => Date;

  constructor(opts: { sink: LogSink; level: LogLevel; mod: string; now: () => Date }) {
    this.sink = opts.sink;
    this.minLevel = opts.level;
    this.mod = opts.mod;
    this.now = opts.now;
  }

  debug(msg: string, kv?: LogFields): void {
    this.emit("debug", msg, kv);
  }

  info(msg: string, kv?: LogFields): void {
    this.emit("info", msg, kv);
  }

  warn(msg: string, kv?: LogFields): void {
    this.emit("warn", msg, kv);
  }

  error(msg: string, kv?: LogFields): void {
    this.emit("error", msg, kv);
  }

  child(mod: string): Logger {
    return new SinkLogger({ sink: this.sink, level: this.minLevel, mod, now: this.now });
  }

  private emit(level: LogLevel, msg: string, kv?: LogFields): void {
    if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(this.minLevel)) return;
    this.sink.write({ ...kv, ts: this.now().toISOString(), level, mod: this.mod, msg });
  }
}
