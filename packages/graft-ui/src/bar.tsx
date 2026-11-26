import type { ReactNode } from "react";
import { cells, color, hairline, type ColorToken } from "./theme/index.ts";

export interface BarProps {
  /** 0 to 1; values outside are clamped. */
  value: number;
  tone?: ColorToken;
  /** Width in cells. */
  cols?: number;
}

const DEFAULT_COLS = 12;

/** A horizontal meter, such as the 5h and weekly usage bars. */
export function Bar(props: BarProps): ReactNode {
  const share = Math.min(1, Math.max(0, props.value));
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={share}
      style={{
        display: "inline-block",
        width: cells(props.cols ?? DEFAULT_COLS),
        height: "0.6em",
        border: hairline("textDim"),
        verticalAlign: "middle",
        background: color("surfaceSunken"),
      }}
    >
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${String(share * 100)}%`,
          background: color(props.tone ?? "accent"),
        }}
      />
    </span>
  );
}
