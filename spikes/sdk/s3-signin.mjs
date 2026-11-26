// Sign-in + spike 3: one tiny turn; capture all messages (method via argv[2]).
import { sdk, loginEnv, apiKeyEnv, save, mkDir, MODEL } from "./common.mjs";
const method = process.argv[2] || "claude-login";
const env = method === "api-key" ? apiKeyEnv(process.env.ANTHROPIC_API_KEY) : loginEnv();
const cwd = mkDir("s3-" + method);
const msgs = [];
const q = sdk.query({
  prompt: "Reply with the single word: ok",
  options: {
    cwd,
    model: MODEL,
    env,
    maxTurns: 1,
    permissionMode: "default",
    settingSources: [],
    stderr: (d) => process.stderr.write("[stderr] " + String(d).slice(0, 300) + "\n"),
  },
});
try {
  for await (const m of q) {
    msgs.push(m);
    console.log(m.type, m.subtype ?? "", m.error ?? "");
  }
} catch (e) {
  console.log("THROWN", e.name, e.message);
  msgs.push({ thrown: { name: e.name, message: e.message } });
}
save(`signin-${method}-messages.json`, msgs);
const rl = msgs.filter((m) => m.type === "rate_limit_event");
console.log("rate_limit_events:", rl.length);
for (const r of rl) console.log(JSON.stringify(r));
save(`rate-limit-${method}.json`, rl);
