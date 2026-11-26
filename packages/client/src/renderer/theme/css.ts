import { cell, colors, fontFamily } from "./tokens.ts";

/** CSS custom properties for every token; set once on the root element. */
export function themeVariables(): Record<string, string> {
  const vars: Record<string, string> = {
    "--cell-w": `${String(cell.widthPx)}px`,
    "--cell-h": `${String(cell.heightPx)}px`,
    "--font-size": `${String(cell.fontPx)}px`,
    "--font-family": fontFamily,
  };
  for (const [name, value] of Object.entries(colors)) {
    vars[`--c-${name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`] = value;
  }
  return vars;
}

/** Global rules: the page is one mono grid on the surface colour. */
export const baseCss = `
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--c-surface);
  color: var(--c-text);
  font-family: var(--font-family);
  font-size: var(--font-size);
  line-height: var(--cell-h);
  overflow: hidden;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; }
`;

export function cells(n: number): string {
  return `calc(var(--cell-w) * ${String(n)})`;
}

export function rows(n: number): string {
  return `calc(var(--cell-h) * ${String(n)})`;
}

export function color(token: keyof typeof colors): string {
  return `var(--c-${token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})`;
}
