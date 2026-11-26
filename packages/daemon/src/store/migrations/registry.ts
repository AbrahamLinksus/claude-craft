/// <reference types="vite/client" />
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** One step of a store file's history: `from` schema version to `to`. */
export interface Migration {
  from: number;
  to: number;
  migrate(old: unknown): unknown;
}

interface MigrationModule {
  migration: Migration;
}

/** `<file>-<from>-<to>.ts`, e.g. `settings-0-1.ts`. */
const NAME = /(?:^|[\\/])([a-z][a-z-]*?)-(\d+)-(\d+)\.ts$/;

/** Vite bundles and vitest resolve the glob statically; plain Node throws and we scan instead. */
function viteGlob(): Record<string, MigrationModule> | undefined {
  try {
    return import.meta.glob<MigrationModule>("./*-*-*.ts", { eager: true });
  } catch {
    return undefined;
  }
}

async function nodeScan(): Promise<Record<string, MigrationModule>> {
  const dir = dirname(fileURLToPath(import.meta.url));
  const names = (await readdir(dir)).filter((n) => NAME.test(n));
  const entries = await Promise.all(
    names.map(
      async (n) =>
        [n, (await import(pathToFileURL(join(dir, n)).href)) as MigrationModule] as const,
    ),
  );
  return Object.fromEntries(entries);
}

const modules = viteGlob() ?? (await nodeScan());

/** Migrations of one store file (e.g. "settings"), oldest first. */
export function migrationsFor(file: string): Migration[] {
  return Object.entries(modules)
    .filter(([path]) => NAME.exec(path)?.[1] === file)
    .map(([, mod]) => mod.migration)
    .sort((a, b) => a.from - b.from);
}
