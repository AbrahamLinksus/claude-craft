import {
  EVENT_SCHEMAS,
  isCoreEventType,
  sessionKey,
  type CoreEventData,
  type CoreEventType,
  type StreamEvent,
} from "@craft/protocol";
import {
  NOTICE_LIMIT,
  TRANSCRIPT_LIMIT,
  type ClientState,
  type SessionEntry,
  type TranscriptLine,
} from "./client-state.ts";

type Reducer<T extends CoreEventType> = (
  state: ClientState,
  data: CoreEventData<T>,
  event: StreamEvent,
) => ClientState;

function updateSession(
  state: ClientState,
  sid: string | undefined,
  change: (s: SessionEntry) => SessionEntry,
): ClientState {
  if (sid === undefined) return state;
  return { ...state, sessions: state.sessions.map((s) => (s.sid === sid ? change(s) : s)) };
}

function addLine(session: SessionEntry, line: TranscriptLine): SessionEntry {
  const last = session.transcript.at(-1);
  const merged =
    line.msgId !== undefined && last?.msgId === line.msgId
      ? [...session.transcript.slice(0, -1), line]
      : [...session.transcript, line];
  return { ...session, transcript: merged.slice(-TRANSCRIPT_LIMIT) };
}

const sessionCreated: Reducer<"SessionCreated"> = (state, d, e) => {
  const sid = sessionKey(d.repoId, d.n);
  if (state.sessions.some((s) => s.sid === sid)) return state;
  const entry: SessionEntry = {
    sid,
    repoId: d.repoId,
    n: d.n,
    branch: d.branch,
    worktree: d.worktree,
    model: d.model,
    pool: d.pool,
    state: "starting",
    turn: 0,
    history: d.history,
    createdAt: e.ts,
    lastActiveAt: e.ts,
    ...(d.parent === undefined ? {} : { parent: { sid: d.parent.sid, turn: d.parent.turn } }),
    transcript: [],
  };
  return { ...state, sessions: [...state.sessions, entry] };
};

const sessionState: Reducer<"SessionState"> = (state, d, e) =>
  updateSession(state, e.sid, (s) => {
    const next: SessionEntry = { ...s, state: d.state, lastActiveAt: e.ts };
    if (d.cryo === undefined) delete next.cryo;
    else next.cryo = d.cryo;
    return next;
  });

const userPrompt: Reducer<"UserPrompt"> = (state, d, e) =>
  updateSession(state, e.sid, (s) =>
    addLine({ ...s, turn: d.turn }, { kind: "user", text: d.text }),
  );

const agentText: Reducer<"AgentText"> = (state, d, e) =>
  updateSession(state, e.sid, (s) => addLine(s, { kind: "agent", msgId: d.msgId, text: d.text }));

const promptQueue: Reducer<"PromptQueueChanged"> = (state, d) => ({
  ...state,
  prompt: d.head === undefined ? { count: d.count } : { head: d.head, count: d.count },
});

const panelState: Reducer<"PanelState"> = (state, d) => ({
  ...state,
  panels: { ...state.panels, [`${d.graft}/${d.panel}`]: d.state },
});

const notice: Reducer<"Notice"> = (state, d) => ({
  ...state,
  notices: [...state.notices, { level: d.level, text: d.text }].slice(-NOTICE_LIMIT),
});

/** Events the client reduces so far; later tasks add one entry each. */
const REDUCERS: { [T in CoreEventType]?: Reducer<T> } = {
  SessionCreated: sessionCreated,
  SessionState: sessionState,
  UserPrompt: userPrompt,
  AgentText: agentText,
  PromptQueueChanged: promptQueue,
  PanelState: panelState,
  Notice: notice,
};

function reduceTyped(type: CoreEventType, state: ClientState, event: StreamEvent): ClientState {
  const reducer = REDUCERS[type] as Reducer<CoreEventType> | undefined;
  if (reducer === undefined) return state;
  const parsed = EVENT_SCHEMAS[type].safeParse(event.data);
  return parsed.success ? reducer(state, parsed.data, event) : state;
}

/** Applies one stream event; unknown, graft and malformed events leave the state alone. */
export function applyEvent(state: ClientState, event: StreamEvent): ClientState {
  return isCoreEventType(event.type) ? reduceTyped(event.type, state, event) : state;
}
