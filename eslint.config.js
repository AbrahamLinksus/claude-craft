import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const limits = {
  complexity: ["error", 10],
  "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
  "max-params": ["error", 4],
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
  "no-console": "error",
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/coverage/**",
      ".tools/**",
      ".results/**",
      ".devteam/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: limits,
  },
  {
    files: ["**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
    rules: { ...limits, "no-console": "off" },
  },
  {
    files: ["**/tests/**", "**/*.test.{ts,tsx}"],
    rules: { "max-lines-per-function": "off" },
  },
);
