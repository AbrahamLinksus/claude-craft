/// <reference types="vite/client" />
import type { ReactNode } from "react";
import type { CraftBridge } from "../preload/api.ts";
import { CraftProvider, type ClientStore, type ScreenDef } from "./state/index.ts";
import { ThemeRoot } from "./theme/index.ts";

const modules = import.meta.glob<{ screen: ScreenDef }>("./screens/*/index.tsx", { eager: true });
const screens = Object.values(modules).map((m) => m.screen);

/** Until the shell (T-06) can switch screens, the first screen is Startup. */
const FIRST_SCREEN = "startup";

export interface AppProps {
  store: ClientStore;
  bridge: CraftBridge;
}

export function App(props: AppProps): ReactNode {
  const current = screens.find((s) => s.id === FIRST_SCREEN) ?? screens[0];
  return (
    <ThemeRoot>
      <CraftProvider store={props.store} bridge={props.bridge}>
        {current?.render()}
      </CraftProvider>
    </ThemeRoot>
  );
}
