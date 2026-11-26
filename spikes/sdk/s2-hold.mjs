// Spike 2: hold a PreToolUse hook (mode=hook) or canUseTool (mode=can) for HOLD_S seconds, then allow.
import { sdk, loginEnv, save, mkDir, MODEL } from "./common.mjs";
const mode = process.argv[2];
const holdS = Number(process.argv[3] ?? 600);
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(1);
const ev = [];
const note = (s) => {
  ev.push(`${el()}s ${s}`);
  console.log(`${el()}s ${s}`);
};
const hold = (ms) => new Promise((r) => setTimeout(r, ms));

const options = {
  cwd: mkDir("s2-" + mode),
  model: MODEL,
  env: loginEnv(),
  maxTurns: 3,
  settingSources: [],
  tools: ["Bash"],
  systemPrompt: "Run the shell command the user gives with the Bash tool, then say done.",
};
if (mode === "hook") {
  options.allowedTools = ["Bash"]; // pre-approved: canUseTool is never asked, only the hook holds
  options.hooks = {
    PreToolUse: [
      {
        timeout: 86_400,
        hooks: [
          async () => {
            note("hook entered, holding");
            await hold(holdS * 1000);
            note("hook releasing (no decision)");
            return {};
          },
        ],
      },
    ],
  };
} else {
  options.canUseTool = async (tool, input) => {
    note(`canUseTool entered for ${tool}, holding`);
    await hold(holdS * 1000);
    note("canUseTool allowing");
    return { behavior: "allow", updatedInput: input };
  };
}
const msgs = [];
let thrown;
try {
  for await (const m of sdk.query({
    prompt: "Run this command: touch marker.txt && echo SPIKE2_OK",
    options,
  })) {
    msgs.push(m);
    if (
      m.type === "user" ||
      m.type === "result" ||
      (m.type === "system" && /state|hook/.test(m.subtype ?? ""))
    )
      note(`msg ${m.type} ${m.subtype ?? ""}`);
  }
} catch (e) {
  thrown = String(e.message).slice(0, 300);
  note("THROWN " + thrown);
}
const toolResults = msgs
  .filter((m) => m.type === "user")
  .flatMap((m) => m.message.content)
  .filter((c) => c.type === "tool_result");
const res = msgs.find((m) => m.type === "result");
const outcome = {
  mode,
  holdS,
  ev,
  thrown,
  toolResults,
  isError: res?.is_error,
  resultSubtype: res?.subtype,
  pass: !thrown && JSON.stringify(toolResults).includes("SPIKE2_OK"),
  totalS: el(),
};
console.log(JSON.stringify(outcome));
save(`spike2-${mode}.json`, outcome);
