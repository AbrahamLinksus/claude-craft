import { useLayoutEffect, type ReactNode } from "react";
import { baseCss, themeVariables } from "./css.ts";

export interface ThemeRootProps {
  children?: ReactNode;
}

/** Puts the token variables and base rules on the page, then renders the app inside. */
export function ThemeRoot(props: ThemeRootProps): ReactNode {
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(themeVariables())) {
      root.style.setProperty(name, value);
    }
    const style = document.createElement("style");
    style.textContent = baseCss;
    document.head.append(style);
    return () => {
      style.remove();
    };
  }, []);
  return <div style={{ height: "100%" }}>{props.children}</div>;
}
