// Spike 1: forkSession at turn N, resume in a different cwd, check it continues from turn N.
import { sdk, loginEnv, save, mkDir, MODEL } from "./common.mjs";
const env = loginEnv();
const A = mkDir("s1-A");
const B = mkDir("s1-B");
const log = { A, B };

async function turn(prompt, cwd, resume) {
  const out = { prompt, cwd, resume };
  const msgs = [];
  try {
    const q = sdk.query({
      prompt,
      options: { cwd, model: MODEL, env, maxTurns: 1, resume, settingSources: [], tools: [] },
    });
    for await (const m of q) msgs.push(m);
  } catch (e) {
    out.thrown = String(e.message).slice(0, 300);
  }
  const res = msgs.find((m) => m.type === "result");
  const asst = msgs.filter((m) => m.type === "assistant");
  out.sessionId = res?.session_id ?? msgs.find((m) => m.session_id)?.session_id;
  out.text = asst
    .flatMap((m) => m.message.content)
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  out.lastAssistantUuid = asst.at(-1)?.uuid;
  out.isError = res?.is_error;
  console.log(JSON.stringify({ ...out, text: out.text.slice(0, 200) }));
  return out;
}

const t1 = await turn("Remember the secret word PINEAPPLE. Reply only with: stored", A);
log.t1 = t1;
const t2 = await turn(
  "Also remember the secret word ZEBRA. Reply only with: stored",
  A,
  t1.sessionId,
);
log.t2 = t2;

// Fork at end of turn 1 (messages as the SDK lists them).
const listed = await sdk.getSessionMessages(t1.sessionId, { dir: A });
log.listed = listed.map((m) => ({ type: m.type, uuid: m.uuid }));
console.log("listed", JSON.stringify(log.listed));
const cut = t1.lastAssistantUuid;
log.cutUuid = cut;
let fork;
try {
  fork = await sdk.forkSession(t1.sessionId, { dir: A, upToMessageId: cut });
  log.fork = fork;
  console.log("fork", JSON.stringify(fork));
} catch (e) {
  log.forkError = String(e.message);
  console.log("forkError", e.message);
}

if (fork) {
  const q =
    "List every secret word I asked you to remember, comma separated, nothing else. If none, say NONE.";
  // 1) resume in a DIFFERENT cwd (the real test)
  log.resumeOtherCwd = await turn(q, B, fork.sessionId);
  // 2) control: resume the fork in the original cwd
  if (
    log.resumeOtherCwd.thrown ||
    /NONE/i.test(log.resumeOtherCwd.text) ||
    !log.resumeOtherCwd.text
  ) {
    log.resumeSameCwd = await turn(q, A, fork.sessionId);
  }
}
save("spike1-fork.json", log);
