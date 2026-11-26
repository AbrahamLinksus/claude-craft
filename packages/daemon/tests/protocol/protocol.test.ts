import { describe, expect, it } from "vitest";
import {
  COMMAND_ARGS,
  COMMAND_NAMES,
  CRAFT_VERSION,
  CraftError,
  ERROR_CODES,
  ERROR_TEMPLATES,
  EVENT_META,
  EVENT_SCHEMAS,
  PROTOCOL_VERSION,
  criticalityOf,
  defaultSettings,
  describeError,
  emptyGrammarTable,
  encodeLine,
  isCoreEventType,
  isCraftError,
  isLogged,
  latestWinsKey,
  parseClientLine,
  parseDaemonLine,
  parseSessionKey,
  proofFor,
  proofsEqual,
  randomNonce,
  sessionKey,
  sessionLabel,
  settingsSchema,
  snapshotSchema,
} from "../../../protocol/src/index.ts";

describe("error codes (LLD 16.1)", () => {
  it("every code has a plain-words template", () => {
    for (const code of ERROR_CODES) expect(ERROR_TEMPLATES[code].length).toBeGreaterThan(5);
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
    for (const code of ["UNAUTHORIZED", "PROTOCOL_ERROR", "PIPE_TAKEN", "CAP_REACHED", "BUS_LAG"]) {
      expect(ERROR_CODES).toContain(code);
    }
  });

  it("fills placeholders and leaves unknown ones as written", () => {
    expect(describeError("NOT_A_GIT_REPO", { path: "C:/x" })).toBe("not a git repo: C:/x");
    expect(describeError("KEY_COLLISION", { k: "p", a: "race" })).toBe(
      "Key p claimed by race and <b>",
    );
  });

  it("CraftError carries the code, the plain message and hidden details", () => {
    const error = new CraftError("ALREADY_PUSHED", {}, { sha: "abc" });
    expect(isCraftError(error)).toBe(true);
    expect(isCraftError(new Error("x"))).toBe(false);
    expect(error.userMessage).toBe("already pushed, can't undo");
    expect(error.message).toBe(error.userMessage);
    expect(error.details).toEqual({ sha: "abc" });
  });
});

describe("events (LLD 1.2)", () => {
  it("every core event has a schema and a criticality", () => {
    expect(Object.keys(EVENT_META).sort()).toEqual(Object.keys(EVENT_SCHEMAS).sort());
    expect(isCoreEventType("SessionState")).toBe(true);
    expect(isCoreEventType("usage/Tick")).toBe(false);
  });

  it("assigns criticality: critical, latest-wins, droppable, partial text, graft events", () => {
    expect(criticalityOf({ type: "TurnFinished", data: {} })).toBe("critical");
    expect(criticalityOf({ type: "GitStatusChanged", data: {} })).toBe("latest-wins");
    expect(criticalityOf({ type: "Spinner", data: {} })).toBe("droppable");
    expect(criticalityOf({ type: "AgentText", data: { partial: true } })).toBe("droppable");
    expect(criticalityOf({ type: "AgentText", data: { partial: false } })).toBe("critical");
    expect(criticalityOf({ type: "radar/Tick", data: {} })).toBe("critical");
    expect(criticalityOf({ type: "radar/Tick", data: {} }, () => "droppable")).toBe("droppable");
    expect(criticalityOf({ type: "radar/Tick", data: {} }, () => undefined)).toBe("critical");
  });

  it("knows which events go to the session log", () => {
    expect(isLogged({ type: "UserPrompt", data: {} })).toBe(true);
    expect(isLogged({ type: "Spinner", data: {} })).toBe(false);
    expect(isLogged({ type: "AgentText", data: { partial: true } })).toBe(false);
    expect(isLogged({ type: "AgentText", data: { partial: false } })).toBe(true);
    expect(isLogged({ type: "Notice", data: {} })).toBe(false);
    expect(isLogged({ type: "Notice", sid: "a/s1", data: {} })).toBe(true);
    expect(isLogged({ type: "g/Ev", sid: "a/s1", data: {} })).toBe(true);
    expect(isLogged({ type: "g/Ev", data: {} })).toBe(false);
  });

  it("builds the replace-key of latest-wins events", () => {
    expect(latestWinsKey({ type: "PanelState", data: { graft: "usage", panel: "bar" } })).toBe(
      "PanelState:usage/bar",
    );
    expect(latestWinsKey({ type: "GitStatusChanged", sid: "a/s1", data: {} })).toBe(
      "GitStatusChanged:a/s1",
    );
  });

  it("validates event data with the schema of the event", () => {
    expect(EVENT_SCHEMAS.Notice.safeParse({ level: "info", text: "hi" }).success).toBe(true);
    expect(EVENT_SCHEMAS.Notice.safeParse({ level: "loud", text: "hi" }).success).toBe(false);
  });
});

describe("ids", () => {
  it("builds, parses and labels session keys", () => {
    const key = sessionKey("api-2", 14);
    expect(key).toBe("api-2/s14");
    expect(parseSessionKey(key)).toEqual({ repoId: "api-2", n: 14 });
    expect(parseSessionKey("api/s0")).toBeUndefined();
    expect(parseSessionKey("nonsense")).toBeUndefined();
    expect(sessionLabel(key)).toBe("s14");
  });
});

describe("commands (LLD 1.3)", () => {
  it("lists every command name once", () => {
    expect(COMMAND_NAMES).toContain("snapshot.get");
    expect(COMMAND_NAMES).toContain("daemon.restart");
    expect(new Set(COMMAND_NAMES).size).toBe(COMMAND_NAMES.length);
  });

  it("validates args with zod", () => {
    expect(COMMAND_ARGS["repo.open"].safeParse({ path: "C:/work/api" }).success).toBe(true);
    expect(COMMAND_ARGS["repo.open"].safeParse({ path: "" }).success).toBe(false);
    expect(COMMAND_ARGS["snapshot.get"].safeParse({ extra: 1 }).success).toBe(false);
    expect(COMMAND_ARGS["graft.setDose"].safeParse({ name: "radar", dose: 9 }).success).toBe(false);
  });
});

describe("wire messages", () => {
  it("round-trips a hello and rejects non-JSON and unknown messages", () => {
    const hello = {
      type: "hello",
      protocol: PROTOCOL_VERSION,
      clientVersion: CRAFT_VERSION,
      clientNonce: "n",
    } as const;
    const line = encodeLine(hello);
    expect(line.endsWith("\n")).toBe(true);
    expect(parseClientLine(line.trim())).toEqual({ ok: true, value: hello });
    expect(parseClientLine("{ nope")).toEqual({ ok: false, reason: "not JSON" });
    expect(parseClientLine('{"type":"dance"}')).toEqual({ ok: false, reason: "bad message" });
    expect(parseDaemonLine('{"type":"resync"}')).toEqual({ ok: true, value: { type: "resync" } });
  });

  it("accepts both reply shapes and refuses a reply with an unknown error code", () => {
    expect(parseDaemonLine('{"type":"reply","id":"c1","ok":true,"data":{}}').ok).toBe(true);
    const failed = {
      type: "reply",
      id: "c1",
      ok: false,
      error: { code: "INTERNAL", message: "m" },
    };
    expect(parseDaemonLine(JSON.stringify(failed)).ok).toBe(true);
    const bad = { ...failed, error: { code: "WHAT", message: "m" } };
    expect(parseDaemonLine(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("handshake proof", () => {
  it("is the same for the same token, role and nonce, and differs otherwise", async () => {
    const nonce = randomNonce();
    const a = await proofFor("token-1", "daemon", nonce);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await proofFor("token-1", "daemon", nonce)).toBe(a);
    expect(await proofFor("token-2", "daemon", nonce)).not.toBe(a);
    expect(await proofFor("token-1", "client", nonce)).not.toBe(a);
    expect(randomNonce()).not.toBe(nonce);
    expect(proofsEqual(a, a)).toBe(true);
    expect(proofsEqual(a, `${a}0`)).toBe(false);
    expect(proofsEqual(a, "0".repeat(64))).toBe(false);
  });
});

describe("settings and snapshot", () => {
  it("defaults are valid and complete", () => {
    const settings = defaultSettings();
    expect(settingsSchema.safeParse(settings).success).toBe(true);
    expect(settings.sessions.cap).toBe(5);
    expect(settings.schema).toBe(1);
  });

  it("an empty snapshot is valid", () => {
    const snapshot = {
      sessions: [],
      repos: [],
      grammar: emptyGrammarTable(),
      prompt: { count: 0 },
      panels: {},
      grafts: [],
      settings: defaultSettings(),
      signIn: { method: null, ready: "unknown" },
    };
    expect(snapshotSchema.safeParse(snapshot).success).toBe(true);
  });
});
