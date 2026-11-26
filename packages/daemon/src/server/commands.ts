import type { AnyCommandHandler, Snapshot } from "@craft/protocol";

export interface ServerCommandDeps {
  snapshot: () => Snapshot;
  /** Ask the daemon to exit so the launcher can start a fresh one (sessions go cryo). */
  restart: () => void;
}

/** Commands owned by the server module, registered by `main.ts`. */
export function commands(deps: ServerCommandDeps): AnyCommandHandler[] {
  return [
    { name: "snapshot.get", run: () => Promise.resolve(deps.snapshot()) },
    {
      name: "daemon.restart",
      run: () => {
        deps.restart();
        return Promise.resolve({});
      },
    },
  ];
}
