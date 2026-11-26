import type { ReactNode } from "react";

/** What every `screens/<id>/index.tsx` exports as `screen` (LLD 13.5). */
export interface ScreenDef {
  id: string;
  title: string;
  render(): ReactNode;
}
