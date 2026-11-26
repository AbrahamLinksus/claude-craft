import type { ReactNode } from "react";
import { GraftBoundary } from "../panels/host.tsx";
import { Box, Row, Text } from "../theme/index.ts";
import { Dot, Meter, Span } from "./inline.tsx";
import { resetTime, usageTone, type UsageView, type UsageWindow } from "./model.ts";

/** A graft widget already built by its graft's UI; the shell only places it in a slot. */
export interface ShellWidget {
  id: string;
  graft: string;
  slot: "topbar" | "statusline";
  element: ReactNode;
}

const METER_COLS = 12;
const PERCENT = 100;

export interface WidgetsProps {
  widgets: readonly ShellWidget[];
  slot: ShellWidget["slot"];
}

/** The widgets of one slot, each fenced in its own error boundary. */
export function Widgets(props: WidgetsProps): ReactNode {
  return props.widgets
    .filter((w) => w.slot === props.slot)
    .map((w) => (
      <GraftBoundary key={w.id} graft={w.graft} kind="widget">
        {w.element}
      </GraftBoundary>
    ));
}

interface UsageBarProps {
  label: string;
  window: UsageWindow | undefined;
}

function UsageBar(props: UsageBarProps): ReactNode {
  const w = props.window;
  if (w === undefined) return <Span tone="textDim">{`${props.label} unknown`}</Span>;
  const percent = Math.round(w.utilization * PERCENT);
  return (
    <span>
      <Span>{props.label}</Span>
      <Meter value={w.utilization} tone={usageTone(w.utilization)} cols={METER_COLS} />
      <Span>{`${String(percent)}%`}</Span>
      <Dot />
      <Span tone="textDim">{`resets ${resetTime(w.resetsAt)}`}</Span>
    </span>
  );
}

export interface TopBarProps {
  usage: UsageView;
  widgets?: readonly ShellWidget[];
}

/** Top line: the brand, the 5h and weekly usage bars, then graft widgets. */
export function TopBar(props: TopBarProps): ReactNode {
  return (
    <Box padX={1} fill="surfaceRaised" borderBottom>
      <Row gap={3}>
        <Text tone="accent" bold>
          Craft
        </Text>
        <UsageBar label="5h" window={props.usage.fiveHour} />
        <UsageBar label="week" window={props.usage.sevenDay} />
        <Widgets widgets={props.widgets ?? []} slot="topbar" />
      </Row>
    </Box>
  );
}
