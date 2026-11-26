import type { ReactNode } from "react";
import type { Mode } from "../input/index.ts";
import { Box, Chip } from "../theme/index.ts";
import { Dot, Span } from "./inline.tsx";
import { branchText, MODE_TONE, modelName, modelTone, type BranchInfo } from "./model.ts";
import { Widgets, type ShellWidget } from "./top-bar.tsx";

export interface StatuslineProps {
  mode: Mode;
  repo?: string | undefined;
  /** The focused session: its label (`s1`) and model id. */
  session?: { label: string; model: string } | undefined;
  branch?: BranchInfo | undefined;
  /** "1 session", "3 sessions · 1 cryo". */
  counts: string;
  widgets?: readonly ShellWidget[];
}

/** Bottom line: `TALK · notes-app · s1 · Sonnet · craft/s1 M1 S0 ↑0 · 1 session`. */
export function Statusline(props: StatuslineProps): ReactNode {
  const { session, branch } = props;
  return (
    <Box padX={1} fill="surfaceRaised" borderTop>
      <Chip tone={MODE_TONE[props.mode]}>{props.mode}</Chip>
      {props.repo === undefined ? null : (
        <>
          <Dot />
          <Span>{props.repo}</Span>
        </>
      )}
      {session === undefined ? null : (
        <>
          <Dot />
          <Span>{session.label}</Span>
          <Dot />
          <Span tone={modelTone(session.model)} bold>
            {modelName(session.model)}
          </Span>
        </>
      )}
      {branch === undefined ? null : (
        <>
          <Dot />
          <Span>{branchText(branch)}</Span>
        </>
      )}
      <Dot />
      <Span>{props.counts}</Span>
      <Widgets widgets={props.widgets ?? []} slot="statusline" />
    </Box>
  );
}
