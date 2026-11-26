import { useEffect, useRef, type ReactNode } from "react";
import { canvasPixels } from "./theme/index.ts";

export interface CanvasProps {
  /** Size in cells. */
  cols: number;
  rows: number;
  /** Draws one frame; called again when the size or `draw` changes. */
  draw: (ctx: CanvasRenderingContext2D, size: { width: number; height: number }) => void;
  label?: string;
}

/** A drawing surface for graphs, sized in cells. */
export function Canvas(props: CanvasProps): ReactNode {
  const ref = useRef<HTMLCanvasElement>(null);
  const { cols, rows, draw } = props;
  const size = canvasPixels(cols, rows);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) draw(ctx, canvasPixels(cols, rows));
  }, [cols, rows, draw]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={props.label ?? "graph"}
      width={size.width}
      height={size.height}
      style={{ maxWidth: "100%" }}
    />
  );
}
