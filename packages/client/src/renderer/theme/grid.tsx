import type { CSSProperties, ReactNode } from "react";
import { cells, color, rows } from "./css.ts";
import type { ColorToken } from "./tokens.ts";

export interface BoxProps {
  /** Padding in cells: horizontal, vertical (rows). */
  padX?: number;
  padY?: number;
  /** Maximum width in cells; the box still shrinks on a narrow window. */
  maxCols?: number;
  fill?: ColorToken;
  borderTop?: boolean;
  borderBottom?: boolean;
  children?: ReactNode;
}

/** A block laid out on the grid: padding and width come in cells. */
export function Box(props: BoxProps): ReactNode {
  const style: CSSProperties = {
    padding: `${rows(props.padY ?? 0)} ${cells(props.padX ?? 0)}`,
    maxWidth: props.maxCols === undefined ? undefined : cells(props.maxCols),
    background: props.fill === undefined ? undefined : color(props.fill),
    borderTop: props.borderTop === true ? `1px solid ${color("line")}` : undefined,
    borderBottom: props.borderBottom === true ? `1px solid ${color("line")}` : undefined,
  };
  return <div style={style}>{props.children}</div>;
}

export interface TextProps {
  tone?: ColorToken;
  bold?: boolean;
  /** Keep on one line, cut with an ellipsis. */
  truncate?: boolean;
  children?: ReactNode;
}

/** One line (or wrapped lines) of mono text in a theme colour. */
export function Text(props: TextProps): ReactNode {
  const style: CSSProperties = {
    color: color(props.tone ?? "text"),
    fontWeight: props.bold === true ? 700 : undefined,
    whiteSpace: props.truncate === true ? "nowrap" : "pre-wrap",
    overflow: props.truncate === true ? "hidden" : undefined,
    textOverflow: props.truncate === true ? "ellipsis" : undefined,
    overflowWrap: "anywhere",
  };
  return <div style={style}>{props.children}</div>;
}

export interface ChipProps {
  tone: ColorToken;
  children: ReactNode;
}

/** A filled label such as TALK or LAB. */
export function Chip(props: ChipProps): ReactNode {
  const style: CSSProperties = {
    background: color(props.tone),
    color: color("onChip"),
    padding: `0 ${cells(1)}`,
    fontWeight: 700,
    display: "inline-block",
  };
  return <span style={style}>{props.children}</span>;
}

export interface RowProps {
  gap?: number;
  children?: ReactNode;
}

/** Items side by side on one line, wrapping on a narrow window. */
export function Row(props: RowProps): ReactNode {
  const style: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    columnGap: cells(props.gap ?? 1),
    alignItems: "baseline",
  };
  return <div style={style}>{props.children}</div>;
}
