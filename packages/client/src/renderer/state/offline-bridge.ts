import type { CraftBridge } from "../../preload/api.ts";

const NO_WORKER = "Craft is not connected to its background worker";

/** Stand-in for `window.craft` when the page is opened in a plain browser (no Electron). */
export function offlineBridge(): CraftBridge {
  return {
    send: (cmd) =>
      Promise.resolve({
        type: "reply",
        id: cmd.name,
        ok: false,
        error: { code: "INTERNAL", message: NO_WORKER },
      }),
    onMessage: () => () => undefined,
    onLinkState: (cb) => {
      cb({ status: "reconnecting" });
      return () => undefined;
    },
    ready: () => Promise.resolve(),
    pickFolder: () => Promise.resolve(undefined),
    log: () => undefined,
  };
}
