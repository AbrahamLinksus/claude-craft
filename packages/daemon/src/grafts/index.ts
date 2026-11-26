import type { AnyCommandHandler, Criticality, GraftView } from "@craft/protocol";
import { notBuilt } from "../domain/index.ts";

export interface GraftHost {
  /** Discover, validate, order and load grafts (LLD 11.3); runs after session recovery. */
  start(): Promise<void>;
  views(): GraftView[];
  /** `"graft/panel"` to the last state set by that panel. */
  panelStates(): Record<string, unknown>;
  panelAction(graft: string, panel: string, action: unknown): Promise<void>;
  setDose(name: string, dose: number): Promise<void>;
  install(name: string): Promise<void>;
  remove(name: string): Promise<void>;
  acceptLeaflet(name: string): Promise<void>;
  /** A port a graft provided (e.g. `workspace`), if loaded. */
  port(name: string): unknown;
  /** Criticality of a graft event type from its manifest; undefined = unknown (critical). */
  eventCriticality(type: string): Criticality | undefined;
}

/** Placeholder until the graft-host task: no grafts. */
export function createGraftHost(): GraftHost {
  return notBuilt<GraftHost>("grafts", {
    start: () => Promise.resolve(),
    views: () => [],
    panelStates: () => ({}),
    port: () => undefined,
    eventCriticality: () => undefined,
  });
}

export function commands(host: GraftHost): AnyCommandHandler[] {
  return [
    {
      name: "panel.action",
      run: async (args) => {
        await host.panelAction(args.graft, args.panel, args.action);
        return {};
      },
    },
    { name: "graft.setDose", run: (args) => host.setDose(args.name, args.dose) },
    { name: "graft.install", run: (args) => host.install(args.name) },
    { name: "graft.remove", run: (args) => host.remove(args.name) },
    { name: "graft.acceptLeaflet", run: (args) => host.acceptLeaflet(args.name) },
  ];
}
