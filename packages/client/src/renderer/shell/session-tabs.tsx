import type { ReactNode } from "react";
import type { SessionView } from "@craft/protocol";
import { cells, color } from "../theme/index.ts";
import { sessionLabel } from "./model.ts";

export interface SessionTabsProps {
  sessions: readonly SessionView[];
  /** The focused session's key. */
  focused?: string;
}

function tabText(s: SessionView): string {
  const note = s.state === "idle" ? "" : ` · ${s.state}`;
  return `${sessionLabel(s)}${note}`;
}

/** One tab per session on session screens (US-11). */
export function SessionTabs(props: SessionTabsProps): ReactNode {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        flexWrap: "wrap",
        borderBottom: `1px solid ${color("line")}`,
        background: color("surfaceSunken"),
      }}
    >
      {props.sessions.map((s) => {
        const on = s.sid === props.focused;
        return (
          <span
            key={s.sid}
            role="tab"
            aria-selected={on}
            style={{
              padding: `0 ${cells(2)}`,
              fontWeight: on ? 700 : undefined,
              color: color(on ? "text" : "textDim"),
              background: on ? color("surface") : undefined,
              borderBottom: `2px solid ${color(on ? "accent" : "line")}`,
            }}
          >
            {tabText(s)}
          </span>
        );
      })}
    </div>
  );
}
