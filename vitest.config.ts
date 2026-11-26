import { defineConfig } from "vitest/config";

const skipThresholds = process.env["CHECK_NO_COVERAGE"] === "1";

// Vitest 5 reads no separate workspace file; one root config covers every workspace.
export default defineConfig({
  test: {
    passWithNoTests: true,
    include: [
      "packages/*/tests/**/*.test.{ts,tsx}",
      "grafts/*/tests/**/*.test.{ts,tsx}",
      "tools/*/tests/**/*.test.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "packages/client/tests/e2e/**"],
    coverage: {
      provider: "v8",
      include: [
        "packages/*/src/**/*.{ts,tsx}",
        "grafts/*/{daemon,ui}/**/*.{ts,tsx}",
        "tools/*/src/**/*.ts",
      ],
      exclude: ["**/index.ts", "**/index.tsx", "**/*.d.ts", "**/tests/**", "**/*.mjs"],
      reporter: ["text", "json-summary"],
      ...(skipThresholds
        ? {}
        : { thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 } }),
    },
  },
});
