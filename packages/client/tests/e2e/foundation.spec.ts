import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..", "..", "..", "..");
const clientDir = join(root, "packages", "client");
const daemonDir = join(root, "packages", "daemon");
const shots = join(root, ".results", "T-01");

let home = "";
let pipe = "";
const apps: ElectronApplication[] = [];

/** Bundles the worker and the client with Vite's own API, so the test runs what is in the source. */
async function buildAll(): Promise<void> {
  const logLevel = "error";
  await build({ root: daemonDir, logLevel, build: { ssr: "src/main.ts", outDir: "dist" } });
  const configFile = join(clientDir, "src", "main", "build.config.ts");
  for (const mode of ["main", "preload", "production"]) {
    await build({ configFile, mode, logLevel });
  }
}

function daemonPid(): number {
  const info = JSON.parse(readFileSync(join(home, "daemon.json"), "utf8")) as { pid: number };
  return info.pid;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(check: () => boolean, what: string, ms = 30_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [join(clientDir, "out", "main", "index.mjs")],
    env: { ...process.env, CRAFT_HOME: home, CRAFT_PIPE: pipe, CRAFT_LOG_LEVEL: "warn" },
  });
  apps.push(app);
  const page = await app.firstWindow();
  return { app, page };
}

/** `app.close()` hangs on Windows, so quit the app and wait for its process to exit. */
async function quit(app: ElectronApplication): Promise<void> {
  const proc = app.process();
  const exited = new Promise<void>((done) => {
    if (proc.exitCode !== null) done();
    proc.once("exit", () => {
      done();
    });
  });
  await app.evaluate(({ app: electronApp }) => {
    electronApp.quit();
  });
  await exited;
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await buildAll();
});

test.beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "craft-e2e-"));
  pipe = `craft-e2e-${randomUUID().slice(0, 8)}`;
  mkdirSync(shots, { recursive: true });
});

test.afterEach(async () => {
  for (const app of apps.splice(0)) {
    if (app.process().exitCode === null) await quit(app).catch(() => undefined);
  }
  if (existsSync(join(home, "daemon.json"))) {
    const pid = daemonPid();
    if (alive(pid)) process.kill(pid);
    await waitFor(() => !alive(pid), "daemon to stop", 10_000).catch(() => undefined);
  }
  rmSync(home, { recursive: true, force: true });
});

test("test_us17_craft_opens_starts_its_worker_and_shows_the_startup_screen", async () => {
  const { page } = await launch();
  await expect(page.getByText("recent repos")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("no repos yet")).toBeVisible();
  await expect(page.getByText("o open folder…")).toBeVisible();
  await expect(page.getByText("j/k move")).toBeVisible();
  await expect(page.getByText("connected", { exact: true })).toBeVisible({ timeout: 30_000 });

  // the page is a mono grid painted with theme tokens
  const look = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return {
      font: style.fontFamily,
      surface: getComputedStyle(document.documentElement).getPropertyValue("--c-surface").trim(),
    };
  });
  expect(look.font.toLowerCase()).toContain("mono");
  expect(look.surface).toMatch(/^#[0-9a-f]{6}$/i);

  // the worker runs on its own, with an owner-only token beside it
  await waitFor(() => existsSync(join(home, "daemon.json")), "daemon.json");
  expect(alive(daemonPid())).toBe(true);
  await page.screenshot({ path: join(shots, "e2e-startup.png") });
});

test("test_us17_closing_the_client_leaves_the_worker_running_and_relaunching_reconnects", async () => {
  const first = await launch();
  await expect(first.page.getByText("connected", { exact: true })).toBeVisible({ timeout: 30_000 });
  await waitFor(() => existsSync(join(home, "daemon.json")), "daemon.json");
  const pid = daemonPid();

  await quit(first.app);
  await new Promise((r) => setTimeout(r, 1000));
  expect(alive(pid), "worker must survive the client").toBe(true);

  const second = await launch();
  await expect(second.page.getByText("recent repos")).toBeVisible({ timeout: 30_000 });
  await expect(second.page.getByText("connected", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  expect(daemonPid()).toBe(pid); // the same worker, not a new one
});

test("test_us17_when_the_worker_dies_the_statusline_says_reconnecting_and_then_it_is_back", async () => {
  const { page } = await launch();
  await expect(page.getByText("connected", { exact: true })).toBeVisible({ timeout: 30_000 });
  await waitFor(() => existsSync(join(home, "daemon.json")), "daemon.json");
  const pid = daemonPid();

  process.kill(pid);
  await expect(page.getByText("reconnecting…")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: join(shots, "e2e-reconnecting.png") });

  // the client starts a new worker by itself
  await expect(page.getByText("connected", { exact: true })).toBeVisible({ timeout: 60_000 });
  await waitFor(() => daemonPid() !== pid, "a new worker", 10_000);
  expect(alive(daemonPid())).toBe(true);
});
