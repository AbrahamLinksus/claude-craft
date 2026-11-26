import type { ReactNode } from "react";
import type { Mode, ParseResult } from "../input/index.ts";
import { PromptOverlay } from "./prompt-overlay.tsx";
import { SessionTabs } from "./session-tabs.tsx";
import { sessionLabel, type BranchInfo } from "./model.ts";
import { Statusline } from "./statusline.tsx";
import { TopBar, type ShellWidget } from "./top-bar.tsx";
import { useShellModel } from "./use-shell-model.ts";
import { WhichKey } from "./which-key.tsx";

export interface ShellProps {
  mode: Mode;
  /** Key of the focused session; the first session when omitted. */
  focusedSid?: string;
  /** Show the session tabs (session screens). */
  tabs?: boolean;
  parse?: ParseResult | undefined;
  branch?: BranchInfo;
  widgets?: readonly ShellWidget[];
  children?: ReactNode;
}

/** The frame around every screen: top bar, tabs, the screen, which-key, statusline, prompt. */
export function Shell(props: ShellProps): ReactNode {
  const m = useShellModel(props.focusedSid);
  const session =
    m.focused === undefined
      ? undefined
      : { label: sessionLabel(m.focused), model: m.focused.model };
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar usage={m.usage} widgets={props.widgets ?? []} />
      {props.tabs === true ? (
        <SessionTabs sessions={m.sessions} focused={m.focused?.sid ?? ""} />
      ) : null}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{props.children}</div>
      {m.prompt === undefined ? <WhichKey parse={props.parse} /> : null}
      <PromptOverlay prompt={m.prompt} session={m.promptSession} />
      <Statusline
        mode={props.mode}
        counts={m.counts}
        widgets={props.widgets ?? []}
        repo={m.repo}
        session={session}
        branch={props.branch}
      />
    </div>
  );
}
