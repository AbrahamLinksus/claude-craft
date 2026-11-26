import { SinkLogger, type LogLine, type LogSink, type Logger } from "../../src/log/index.ts";

export class MemorySink implements LogSink {
  readonly lines: LogLine[] = [];

  write(line: LogLine): void {
    this.lines.push(line);
  }
}

export function memoryLogger(level: "debug" | "info" | "warn" | "error" = "debug"): {
  log: Logger;
  sink: MemorySink;
} {
  const sink = new MemorySink();
  const log = new SinkLogger({ sink, level, mod: "test", now: () => new Date(0) });
  return { log, sink };
}
