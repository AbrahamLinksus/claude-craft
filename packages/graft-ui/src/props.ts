import type { ComponentType } from "react";
import type { Theme } from "./theme/index.ts";

/** What the daemon replies to a panel action. */
export interface Reply {
  ok: boolean;
  error?: string;
}

export interface PanelProps<S = unknown> {
  state: S;
  send(action: unknown): Promise<Reply>;
  focused: boolean;
  theme: Theme;
  size: { cols: number; rows: number };
}

export interface WidgetProps<S = unknown> {
  state: S;
  theme: Theme;
  slot: "topbar" | "statusline" | "tile";
}

/** The default export of a graft's `dist/ui.js` (LLD 14). */
export interface GraftUiModule {
  panels?: Record<string, ComponentType<PanelProps>>;
  widgets?: Record<string, ComponentType<WidgetProps>>;
}
