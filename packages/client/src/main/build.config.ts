import { builtinModules } from "node:module";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

const here = resolve(import.meta.dirname, "..", "..");
const nodeBuiltins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

/** Main and preload are bundled for Electron's own Node; `electron` stays external. */
function electronBundle(entry: string, outDir: string, format: "es" | "cjs"): UserConfig {
  return {
    build: {
      outDir: resolve(here, "out", outDir),
      emptyOutDir: true,
      target: "node24",
      minify: false,
      lib: {
        entry: resolve(here, "src", entry),
        formats: [format],
        fileName: () => `index.${format === "es" ? "mjs" : "cjs"}`,
      },
      rolldownOptions: { external: ["electron", ...nodeBuiltins] },
    },
  };
}

/** `vite build --mode main|preload` builds the Electron halves; the default builds the window. */
export default defineConfig(({ mode }) => {
  if (mode === "main") return electronBundle("main/index.ts", "main", "es");
  if (mode === "preload") return electronBundle("preload/index.ts", "preload", "cjs");
  return {
    root: resolve(here, "src", "renderer"),
    base: "./",
    plugins: [react()],
    server: { port: 8001, strictPort: true },
    build: { outDir: resolve(here, "out", "renderer"), emptyOutDir: true },
  };
});
