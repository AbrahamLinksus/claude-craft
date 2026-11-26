import type { Cryo, SessionStateName } from "../../../protocol/src/index.ts";

/** Events that move a session between states (LLD 7.2 diagram). */
export type FsmEvent =
  | { type: "started" }
  | { type: "turnFinished" }
  | { type: "prompt" }
  | { type: "offline" }
  | { type: "online" }
  | { type: "offlineTimeout" }
  | { type: "limit"; resetsAt?: string }
  | { type: "stop" }
  | { type: "daemonRestart"; midTurn: boolean }
  | { type: "pause" }
  | { type: "unpause" }
  | { type: "resume" }
  | { type: "toGraveyard" }
  | { type: "fromGraveyard" }
  | { type: "startFailed" };

export interface FsmResult {
  state: SessionStateName;
  cryo?: Cryo;
}

const LIVE_STATES: readonly SessionStateName[] = [
  "starting",
  "running",
  "idle",
  "retrying",
  "paused",
];

function cryo(reason: Cryo["reason"], resetsAt?: string): FsmResult {
  return resetsAt === undefined
    ? { state: "cryo", cryo: { reason } }
    : { state: "cryo", cryo: { reason, resetsAt } };
}

type Rule = (from: SessionStateName, e: FsmEvent) => FsmResult | undefined;

function simple(event: FsmEvent["type"], from: SessionStateName[], to: SessionStateName): Rule {
  return (state, e) => (e.type === event && from.includes(state) ? { state: to } : undefined);
}

const RULES: readonly Rule[] = [
  simple("started", ["starting"], "running"),
  simple("turnFinished", ["running"], "idle"),
  simple("prompt", ["idle"], "running"),
  simple("offline", ["running"], "retrying"),
  simple("online", ["retrying"], "running"),
  simple("pause", ["running", "idle"], "paused"),
  simple("unpause", ["paused"], "running"),
  simple("resume", ["cryo"], "starting"),
  simple("toGraveyard", ["idle"], "graveyard"),
  simple("fromGraveyard", ["graveyard"], "idle"),
  simple("startFailed", ["starting"], "failed"),
  (s, e) => (e.type === "offlineTimeout" && s === "retrying" ? cryo("offline") : undefined),
  (s, e) => (e.type === "limit" && s === "running" ? cryo("limit", e.resetsAt) : undefined),
  (s, e) => (e.type === "stop" && LIVE_STATES.includes(s) ? cryo("stopped") : undefined),
  (s, e) =>
    e.type === "daemonRestart" && LIVE_STATES.includes(s)
      ? cryo(e.midTurn ? "interrupted" : "daemon-restart")
      : undefined,
];

/** Next state for `event` in `from`, or undefined when the transition is not allowed. */
export function transition(from: SessionStateName, event: FsmEvent): FsmResult | undefined {
  for (const rule of RULES) {
    const result = rule(from, event);
    if (result !== undefined) return result;
  }
  return undefined;
}
