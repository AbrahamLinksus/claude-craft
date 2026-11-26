import type { CSSProperties, ReactNode } from "react";
import { cells, color } from "./theme/index.ts";

export interface TableColumn<T> {
  title: string;
  /** Width in cells; omit to share the rest. */
  cols?: number;
  cell(row: T): ReactNode;
}

export interface TableProps<T> {
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  keyOf(row: T, index: number): string;
  empty?: ReactNode;
}

/** Rows and columns on the cell grid, with a dim header row. */
export function Table<T>(props: TableProps<T>): ReactNode {
  const template = props.columns
    .map((c) => (c.cols === undefined ? "minmax(0, 1fr)" : cells(c.cols)))
    .join(" ");
  const line: CSSProperties = {
    display: "grid",
    gridTemplateColumns: template,
    columnGap: cells(1),
  };
  return (
    <div role="table">
      <div role="row" style={{ ...line, color: color("textDim") }}>
        {props.columns.map((c) => (
          <div key={c.title} role="columnheader">
            {c.title}
          </div>
        ))}
      </div>
      {props.rows.length === 0 ? (
        <div style={{ color: color("textDim") }}>{props.empty ?? "no rows"}</div>
      ) : (
        props.rows.map((row, i) => (
          <div role="row" key={props.keyOf(row, i)} style={line}>
            {props.columns.map((c) => (
              <div key={c.title} role="cell" style={{ minWidth: 0 }}>
                {c.cell(row)}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
