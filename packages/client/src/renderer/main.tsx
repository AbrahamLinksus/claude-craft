import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { CraftBridge } from "../preload/api.ts";
import { App } from "./app.tsx";
import { CraftStore, offlineBridge } from "./state/index.ts";

declare global {
  interface Window {
    craft?: CraftBridge;
  }
}

const root = document.getElementById("root");
if (root !== null) {
  const store = new CraftStore((cb) => {
    requestAnimationFrame(cb);
  });
  createRoot(root).render(
    <StrictMode>
      <App store={store} bridge={window.craft ?? offlineBridge()} />
    </StrictMode>,
  );
}
