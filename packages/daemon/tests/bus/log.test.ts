import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DailyFileSink, LOG_FILES_KEPT, SinkLogger, parseLogLevel } from "../../src/log/index.ts";
import { MemorySink } from "../_support/memory-log.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("logger (LLD 16.2)", () => {
  it("parses the level from CRAFT_LOG_LEVEL and falls back to info", () => {
    expect(parseLogLevel("DEBUG")).toBe("debug");
    expect(parseLogLevel("loud")).toBe("info");
    expect(parseLogLevel(undefined)).toBe("info");
  });

  it("drops lines below the level and tags every line with its module", () => {
    const sink = new MemorySink();
    const log = new SinkLogger({ sink, level: "warn", mod: "daemon", now: () => new Date(0) });
    log.debug("no");
    log.info("no");
    log.warn("yes", { conn: "1" });
    log.child("server").error("boom");
    expect(sink.lines.map((l) => [l.mod, l.level, l.msg])).toEqual([
      ["daemon", "warn", "yes"],
      ["server", "error", "boom"],
    ]);
    expect(sink.lines[0]).toMatchObject({ conn: "1", ts: "1970-01-01T00:00:00.000Z" });
  });

  it("writes JSON lines to a file per day and keeps only the newest 7 files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "craft-logs-"));
    dirs.push(dir);
    for (let day = 1; day <= 9; day++) {
      writeFileSync(join(dir, `daemon-202601${String(day).padStart(2, "0")}.log`), "old\n");
    }
    writeFileSync(join(dir, "client-2026-01-01.log"), "not ours\n");
    const sink = new DailyFileSink(dir);
    sink.write({ ts: "2026-01-10T10:00:00.000Z", level: "info", mod: "daemon", msg: "one" });
    sink.write({ ts: "2026-01-10T10:00:01.000Z", level: "warn", mod: "daemon", msg: "two" });
    await sink.flush();
    const lines = readFileSync(join(dir, "daemon-20260110.log"), "utf8").trim().split("\n");
    expect(lines.map((l) => (JSON.parse(l) as { msg: string }).msg)).toEqual(["one", "two"]);
    const kept = readdirSync(dir).filter((n) => n.startsWith("daemon-"));
    expect(kept).toHaveLength(LOG_FILES_KEPT);
    expect(existsSync(join(dir, "daemon-20260101.log"))).toBe(false);
    expect(existsSync(join(dir, "client-2026-01-01.log"))).toBe(true);
  });
});
