import type { ReactNode } from "react";
import { cells, color } from "./theme/index.ts";

export interface ListProps<T> {
  items: readonly T[];
  render(item: T, index: number): ReactNode;
  keyOf(item: T, index: number): string;
  /** Index drawn as selected. */
  selected?: number;
  /** Shown when `items` is empty. */
  empty?: ReactNode;
}

/** A vertical list with one selected row. */
export function List<T>(props: ListProps<T>): ReactNode {
  if (props.items.length === 0) {
    return <div style={{ color: color("textDim") }}>{props.empty ?? "nothing here"}</div>;
  }
  return (
    <div role="list">
      {props.items.map((item, i) => (
        <div
          role="listitem"
          key={props.keyOf(item, i)}
          style={{
            background: i === props.selected ? color("surfaceRaised") : undefined,
            padding: `0 ${cells(1)}`,
          }}
        >
          {props.render(item, i)}
        </div>
      ))}
    </div>
  );
}
