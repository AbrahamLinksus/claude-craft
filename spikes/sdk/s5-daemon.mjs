// Spike 5 fake daemon: 5 SDK sessions, each running a long tool child (sleep). Prints READY when all 5 tools run.
// argv[2] = 'default' (SDK default spawn) | 'tracked' (spawnClaudeCodeProcess with plain non-detached spawn)
import { spawn } from "node:child_process";
import fs from "node:fs";
import { sdk, loginEnv, mkDir, MODEL } from "./common.mjs";
const variant = process.argv[2] ?? "default";
let started = 0;
function announce() {
  console.log("READY " + process.pid);
  if (process.env.READY_FILE) fs.writeFileSync(process.env.READY_FILE, "READY " + process.pid);
}
// 'fake' variant: no model calls. 5 child node processes (stand-ins for claude.exe), each starting a bash+sleep grandchild.
if (variant === "fake") {
  for (let i = 0; i < 5; i++)
    spawn(
      process.execPath,
      [
        "-e",
        "require('child_process').spawn('bash',['-c','sleep 280'],{stdio:'ignore'});setTimeout(()=>{},280000)",
      ],
      { stdio: "ignore", windowsHide: true },
    );
  setTimeout(announce, 4000);
  await new Promise((r) => setTimeout(r, 300000));
  process.exit(0);
}
const announceHooks = {
  PreToolUse: [
    {
      hooks: [
        async () => {
          if (++started === 5) setTimeout(() => announce(), 6000);
          return {};
        },
      ],
    },
  ],
};
function session(i) {
  const options = {
    cwd: mkDir("s5-" + i),
    model: MODEL,
    env: loginEnv(),
    maxTurns: 2,
    settingSources: [],
    tools: ["Bash"],
    allowedTools: ["Bash"],
    systemPrompt: "Run the shell command the user gives with the Bash tool, then say done.",
  };
  if (variant === "tracked") {
    options.spawnClaudeCodeProcess = (o) =>
      spawn(o.command, o.args, {
        cwd: o.cwd,
        env: o.env,
        signal: o.signal,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
  }
  options.hooks = announceHooks;
  return (async () => {
    try {
      for await (const m of sdk.query({ prompt: "Run this command: sleep 280", options })) void m;
    } catch (e) {
      console.error("session", i, String(e.message).slice(0, 120));
    }
  })();
}
await Promise.all([1, 2, 3, 4, 5].map(session));
console.log("ALL DONE (should not happen before kill)");
