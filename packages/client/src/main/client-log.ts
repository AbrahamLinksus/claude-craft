import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LogLevel } from "../preload/api.ts";

export interface ClientLog {
  write(level: LogLevel, message: string): void;
}

/** One JSON line per entry in `<logs>/client-YYYY-MM-DD.log` (LLD 16.2); failures are dropped. */
export function fileClientLog(logsDir: string, now: () => Date): ClientLog {
  return {
    write(level, message) {
      const at = now();
      const file = join(logsDir, `client-${at.toISOString().slice(0, 10)}.log`);
      const line = `${JSON.stringify({ ts: at.toISOString(), level, mod: "client", msg: message })}\n`;
      void mkdir(logsDir, { recursive: true })
        .then(() => appendFile(file, line))
        .catch(() => undefined);
    },
  };
}
