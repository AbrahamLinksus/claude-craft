import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe(".env.example (G-04)", () => {
  it("test_g04_lists_every_variable_Craft_reads", () => {
    const text = readFileSync(
      join(import.meta.dirname, "..", "..", "..", "..", ".env.example"),
      "utf8",
    );
    const names = text
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => l.split("=")[0]);
    expect(names).toEqual(
      expect.arrayContaining(["CRAFT_HOME", "CRAFT_PIPE", "CRAFT_LOG_LEVEL", "ANTHROPIC_API_KEY"]),
    );
    expect(text).not.toMatch(/sk-[a-z]+-\w{8,}/); // names only, never a real key
  });
});
