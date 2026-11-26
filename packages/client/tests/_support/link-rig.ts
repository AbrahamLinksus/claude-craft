import { vi } from "vitest";
import { DaemonLink, type LinkDeps } from "../../src/main/link.ts";
import type { LinkState } from "../../src/main/link-types.ts";
import { FakeWorkerConnection, type WorkerOptions } from "./fake-worker.ts";

export const TOKEN = "t".repeat(64);
const links: DaemonLink[] = [];

export interface Rig {
  link: DaemonLink;
  workers: FakeWorkerConnection[];
  states: LinkState[];
  ensureRunning: ReturnType<typeof vi.fn>;
  options: { next: Partial<WorkerOptions> };
}

export function rig(overrides: Partial<LinkDeps> = {}): Rig {
  const workers: FakeWorkerConnection[] = [];
  const options = { next: {} as Partial<WorkerOptions> };
  const ensureRunning = vi.fn(() => Promise.resolve());
  const link = new DaemonLink({
    connect: () => {
      const w = new FakeWorkerConnection({ token: TOKEN, ...options.next });
      workers.push(w);
      return w.client;
    },
    readToken: () => Promise.resolve(TOKEN),
    launcher: { ensureRunning },
    delay: () => new Promise((resolve) => setTimeout(resolve, 2)),
    clientVersion: "test",
    ...overrides,
  });
  links.push(link);
  const states: LinkState[] = [];
  link.on("state", (s) => states.push(s));
  return { link, workers, states, ensureRunning, options };
}

export async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 500; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`timed out waiting for ${what}`);
}

export function closeLinks(): void {
  for (const l of links.splice(0)) l.close();
}
