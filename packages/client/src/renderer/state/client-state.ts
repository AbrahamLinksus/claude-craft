import {
  emptyGrammarTable,
  type GraftView,
  type GrammarTable,
  type RepoView,
  type SessionView,
  type SignInStatus,
  type Snapshot,
} from "../../../../protocol/src/index.ts";
import type { LinkState } from "../../preload/api.ts";

/** Lines kept per session; older ones are fetched on scroll (LLD 13.2). */
export const TRANSCRIPT_LIMIT = 5_000;
/** Notices kept for the statusline and the notice list. */
export const NOTICE_LIMIT = 50;

export interface TranscriptLine {
  kind: "user" | "agent" | "tool" | "error";
  /** Groups the streamed pieces of one agent message. */
  msgId?: string;
  text: string;
}

export interface SessionEntry extends SessionView {
  transcript: TranscriptLine[];
}

export interface NoticeEntry {
  level: "info" | "warn" | "error";
  text: string;
}

export interface PromptState {
  head?: Snapshot["prompt"]["head"];
  count: number;
}

export interface ClientState {
  /** False until the first snapshot arrives. */
  loaded: boolean;
  link: LinkState;
  repos: RepoView[];
  sessions: SessionEntry[];
  prompt: PromptState;
  grammar: GrammarTable;
  panels: Record<string, unknown>;
  grafts: GraftView[];
  usage: unknown;
  signIn: SignInStatus | undefined;
  notices: NoticeEntry[];
}

export function initialState(): ClientState {
  return {
    loaded: false,
    link: { status: "connecting" },
    repos: [],
    sessions: [],
    prompt: { count: 0 },
    grammar: emptyGrammarTable(),
    panels: {},
    grafts: [],
    usage: undefined,
    signIn: undefined,
    notices: [],
  };
}

/** A fresh state from a full snapshot; the link state is kept. */
export function fromSnapshot(snapshot: Snapshot, link: LinkState): ClientState {
  return {
    loaded: true,
    link,
    repos: snapshot.repos,
    sessions: snapshot.sessions.map((s) => ({ ...s, transcript: [] })),
    prompt: snapshot.prompt,
    grammar: snapshot.grammar,
    panels: snapshot.panels,
    grafts: snapshot.grafts,
    usage: snapshot.usage,
    signIn: snapshot.signIn,
    notices: [],
  };
}
