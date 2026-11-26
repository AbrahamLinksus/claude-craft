// Shared helpers for the T-02 SDK spikes. Never prints or stores credentials.
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

export const here = path.dirname(fileURLToPath(import.meta.url));
const sdkDir = path.resolve(
  here,
  "../../packages/daemon/node_modules/@anthropic-ai/claude-agent-sdk",
);
export const sdk = await import(pathToFileURL(path.join(sdkDir, "sdk.mjs")).href);

// Parent env without anything inherited from a running Claude Code / desktop agent session
// (CLAUDECODE, CLAUDE_CODE_*), so the spike sees what a stand-alone daemon would see.
// CLAUDE_CONFIG_DIR is kept: the scripts set it on purpose for the isolated runs.
function baseEnv() {
  const e = { ...process.env };
  for (const k of Object.keys(e))
    if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_")) delete e[k];
  delete e.ANTHROPIC_AUTH_TOKEN;
  return e;
}
// Env for the "claude-login" path (LLD 6.3): no API key / auth token.
export function loginEnv() {
  const e = baseEnv();
  delete e.ANTHROPIC_API_KEY;
  return e;
}
export function apiKeyEnv(key) {
  return { ...baseEnv(), ANTHROPIC_API_KEY: key };
}
const SECRET =
  /(sk-ant-[A-Za-z0-9_-]+|"(?:access|refresh)Token"\s*:\s*"[^"]+"|Bearer\s+[A-Za-z0-9._-]+)/g;
const USER = path.basename(process.env.USERPROFILE || process.env.HOME || "");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The user name as a whole name segment, in any path style (C:\Users\x, C:/Users/x, C--Users-x-...).
const USER_RE = USER ? new RegExp(`(?<![A-Za-z0-9])${escapeRe(USER)}(?![A-Za-z0-9])`, "gi") : null;
export function redact(o) {
  let t = JSON.stringify(o).replace(SECRET, "[redacted]");
  if (USER_RE) t = t.replace(USER_RE, "<user>");
  return JSON.parse(t);
}
export function save(name, obj) {
  fs.mkdirSync(path.join(here, "fixtures"), { recursive: true });
  fs.writeFileSync(path.join(here, "fixtures", name), JSON.stringify(redact(obj), null, 2) + "\n");
}
export function mkDir(name) {
  const dir = path.join(process.env.SPIKE_TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
export const MODEL = process.env.SPIKE_MODEL || "haiku";
