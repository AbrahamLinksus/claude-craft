// Sign-in error shapes: "not signed in" (empty CLAUDE_CONFIG_DIR) and "refused" (bogus key).
import { sdk, loginEnv, save, mkDir, MODEL } from "./common.mjs";
const which = process.argv[2];
const env = loginEnv();
if (which === "not-signed-in") env.CLAUDE_CONFIG_DIR = mkDir("empty-config");
if (which === "refused-key-isolated") {
  env.CLAUDE_CONFIG_DIR = mkDir("empty-config2");
}
if (which.startsWith("refused-key"))
  env.ANTHROPIC_API_KEY = "sk-ant-api03-INVALIDINVALIDINVALID-spike";
const msgs = [];
const stderr = [];
const q = sdk.query({
  prompt: "Reply with the single word: ok",
  options: {
    cwd: mkDir("auth-" + which),
    model: MODEL,
    env,
    maxTurns: 1,
    settingSources: [],
    stderr: (d) => stderr.push(String(d).slice(0, 400)),
  },
});
try {
  for await (const m of q) {
    msgs.push(m);
    console.log(m.type, m.subtype ?? "", m.error ?? "", m.is_error ?? "");
  }
} catch (e) {
  console.log("THROWN", e.name, e.message);
  msgs.push({ thrown: { name: e.name, message: e.message } });
}
console.log("stderr lines:", stderr.length, stderr.slice(0, 3));
save(`auth-${which}.json`, { messages: msgs, stderr });
for (const m of msgs)
  if (m.type === "result" || m.type === "assistant") console.log(JSON.stringify(m).slice(0, 900));
