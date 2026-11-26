import { cell, colors, type ColorToken } from "./tokens.ts";

function kebab(token: string): string {
  return token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Width of `n` character cells; the variables are set by the app's theme root. */
export function cells(n: number): string {
  return `calc(var(--cell-w) * ${String(n)})`;
}

/** Height of `n` text rows. */
export function rows(n: number): string {
  return `calc(var(--cell-h) * ${String(n)})`;
}

/** A theme colour as a CSS value. */
export function color(token: ColorToken): string {
  return `var(--c-${kebab(token)})`;
}

/** One hairline, the only border width in the UI. */
export function hairline(token: ColorToken = "line"): string {
  return `1px solid ${color(token)}`;
}

/** Device size of a canvas that covers `cols` x `rowCount` cells. */
export function canvasPixels(cols: number, rowCount: number): { width: number; height: number } {
  return { width: cols * cell.widthPx, height: rowCount * cell.heightPx };
}

/** The values a graft's UI receives as `theme`. */
export const theme = { cell, colors } as const;
export type Theme = typeof theme;
