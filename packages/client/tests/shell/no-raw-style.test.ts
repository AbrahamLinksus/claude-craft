import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..", "..", "..");
const dirs = [
  join(root, "packages", "client", "src", "renderer"),
  join(root, "packages", "graft-ui", "src"),
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("theme is the only place for raw pixels and colours", () => {
  it("no component outside theme/ uses a pixel size or a colour literal", () => {
    const raw = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\d\s*px\b/;
    const offenders: string[] = [];
    for (const file of dirs.flatMap(sources)) {
      if (file.split(sep).includes("theme")) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (raw.test(line)) {
            offenders.push(`${relative(root, file)}:${String(i + 1)}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
