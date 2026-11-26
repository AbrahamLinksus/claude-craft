import type { ReactNode } from "react";
import { cells, color, rows, type ColorToken } from "../theme/index.ts";

export interface SpanProps {
  tone?: ColorToken;
  bold?: boolean;
  children?: ReactNode;
}

/** Inline coloured text, so a line reads as one sentence. */
export function Span(props: SpanProps): ReactNode {
  return (
    <span
      style={{
        color: color(props.tone ?? "text"),
        fontWeight: props.bold === true ? 700 : undefined,
      }}
    >
      {props.children}
    </span>
  );
}

/** The dim " · " between line segments. */
export function Dot(): ReactNode {
  return <Span tone="textDim">{" · "}</Span>;
}

export interface MeterProps {
  /** 0 to 1. */
  value: number;
  tone: ColorToken;
  cols: number;
}

/** A small filled meter; the usage bars in the top bar. */
export function Meter(props: MeterProps): ReactNode {
  const share = Math.min(1, Math.max(0, props.value));
  return (
    <span
      role="meter"
      aria-valuenow={share}
      style={{
        display: "inline-block",
        width: cells(props.cols),
        height: "0.6em",
        border: `1px solid ${color("textDim")}`,
        verticalAlign: "middle",
        margin: `0 ${cells(1)}`,
      }}
    >
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${String(share * 100)}%`,
          background: color(props.tone),
        }}
      />
    </span>
  );
}

export interface FrameProps {
  tone: ColorToken;
  maxCols?: number;
  children?: ReactNode;
}

/** A hairline box on the raised surface, padded in cells. */
export function Frame(props: FrameProps): ReactNode {
  return (
    <div
      style={{
        border: `1px solid ${color(props.tone)}`,
        background: color("surfaceRaised"),
        padding: `${rows(0)} ${cells(1)}`,
        maxWidth: props.maxCols === undefined ? undefined : cells(props.maxCols),
        minWidth: 0,
      }}
    >
      {props.children}
    </div>
  );
}
