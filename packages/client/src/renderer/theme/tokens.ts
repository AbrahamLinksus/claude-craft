/** Design tokens (LLD 13.4). Raw colours and font sizes live here and nowhere else. */
export const colors = {
  surface: "#1f1d1a",
  surfaceRaised: "#2a2723",
  surfaceSunken: "#171512",
  line: "#3a3631",
  text: "#ece8e1",
  textDim: "#9a948a",
  accent: "#d97757",
  committed: "#7ec27e",
  staged: "#e0c25a",
  modified: "#e0685c",
  opus: "#d97757",
  sonnet: "#5b9bd5",
  haiku: "#4fb3a9",
  talk: "#5b9bd5",
  lab: "#e0a83a",
  onChip: "#171512",
} as const;

/** One character cell; every size in the UI is a whole number of these. */
export const cell = { fontPx: 15, widthPx: 9, heightPx: 22 } as const;

export const fontFamily =
  '"Cascadia Mono", "Cascadia Code", Consolas, "SF Mono", Menlo, "DejaVu Sans Mono", monospace';

export type ColorToken = keyof typeof colors;
