import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OpenPrompt, SessionView } from "@craft/protocol";
import * as ui from "@craft/graft-ui";
import { GraftBoundary, PanelHost } from "../../src/renderer/panels/host.tsx";
import {
  PromptOverlay,
  SessionTabs,
  Shell,
  Statusline,
  TopBar,
  WhichKey,
} from "../../src/renderer/shell/index.ts";
import { colors } from "../../src/renderer/theme/index.ts";
import { CraftProvider, CraftStore, offlineBridge } from "../../src/renderer/state/index.ts";
import { emptySnapshot } from "../_support/fake-worker.ts";

const session = (n: number, state: SessionView["state"] = "idle"): SessionView => ({
  sid: `notes-app/s${String(n)}` as SessionView["sid"],
  repoId: "notes-app",
  n,
  branch: `craft/s${String(n)}`,
  worktree: "C:/w",
  model: "claude-sonnet-4-5",
  pool: "own",
  state,
  turn: 0,
  history: "repo",
  createdAt: "t",
  lastActiveAt: "t",
});

const prompt = (extra: Partial<OpenPrompt> = {}): OpenPrompt => ({
  id: "p1",
  kind: "approval",
  sid: "notes-app/s2" as OpenPrompt["sid"],
  source: "core",
  title: "Run npm test?",
  body: ["in worktree s2"],
  options: [
    { key: "y", label: "yes" },
    { key: "n", label: "no" },
  ],
  position: 1,
  total: 3,
  ...extra,
});

function renderShell(
  snapshot: ReturnType<typeof emptySnapshot>,
  shellProps: Partial<Parameters<typeof Shell>[0]> = {},
): string {
  const store = new CraftStore((cb) => {
    cb();
  });
  store.applySnapshot(snapshot, 1);
  return renderToStaticMarkup(
    <CraftProvider store={store} bridge={offlineBridge()}>
      <Shell mode="TALK" {...shellProps}>
        <span>screen body</span>
      </Shell>
    </CraftProvider>,
  );
}

const text = (html: string): string => html.replace(/<[^>]+>/g, "");

function Boom(): never {
  throw new Error("kaput");
}

function quietly(fn: () => void): void {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
}

describe("Statusline (US-15)", () => {
  it("test_us15_renders_a_session_view_with_a_blue_talk_chip_and_a_blue_sonnet", () => {
    const html = renderToStaticMarkup(
      <Statusline
        mode="TALK"
        repo="notes-app"
        session={{ label: "s1", model: "claude-sonnet-4-5" }}
        branch={{ name: "craft/s1", modified: 1, staged: 0, ahead: 0 }}
        counts="1 session"
      />,
    );
    expect(text(html)).toBe("TALK · notes-app · s1 · Sonnet · craft/s1 M1 S0 ↑0 · 1 session");
    expect(html).toContain("var(--c-talk)");
    expect(html).toContain("var(--c-sonnet)");
  });

  it("paints the LAB chip amber and Opus orange, Haiku teal", () => {
    const lab = renderToStaticMarkup(
      <Statusline mode="LAB" session={{ label: "s1", model: "opus" }} counts="1 session" />,
    );
    expect(lab).toContain("var(--c-lab)");
    expect(lab).toContain("var(--c-opus)");
    const haiku = renderToStaticMarkup(
      <Statusline mode="TALK" session={{ label: "s1", model: "haiku" }} counts="x" />,
    );
    expect(haiku).toContain("var(--c-haiku)");
    expect(colors.talk).not.toBe(colors.lab);
    expect(colors.opus).not.toBe(colors.sonnet);
    expect(colors.sonnet).not.toBe(colors.haiku);
  });

  it("test_us15_the_shell_builds_the_line_from_the_store", () => {
    const snap = { ...emptySnapshot(), sessions: [session(1)] };
    snap.repos = [
      {
        repoId: "notes-app",
        repoKey: "k",
        path: "C:/notes-app",
        name: "notes-app",
        lastOpened: "t",
      },
    ];
    const html = renderShell(snap, {
      branch: { name: "craft/s1", modified: 1, staged: 0, ahead: 0 },
    });
    expect(text(html)).toContain("TALK · notes-app · s1 · Sonnet · craft/s1 M1 S0 ↑0 · 1 session");
  });
});

describe("PromptOverlay (US-08)", () => {
  it("test_us08_shows_the_queue_head_as_1_of_3_with_the_session_named_first", () => {
    const html = renderToStaticMarkup(<PromptOverlay prompt={prompt()} session="s2" />);
    const t = text(html);
    expect(t).toContain("1 of 3 · s2 · Run npm test?");
    expect(t).toContain("y yes");
    expect(t).toContain("in worktree s2");
    expect(html).toContain('role="dialog"');
  });

  it("renders nothing when the queue is empty and skips the session when unknown", () => {
    expect(renderToStaticMarkup(<PromptOverlay prompt={undefined} />)).toBe("");
    const t = text(renderToStaticMarkup(<PromptOverlay prompt={prompt({ body: undefined })} />));
    expect(t).toContain("1 of 3 · Run npm test?");
  });

  it("D-T2-01: sits above the statusline and hides which-key while open", () => {
    const parse = {
      status: "partial" as const,
      count: 1,
      next: [{ key: "s", name: "session", owner: "core" }],
    };
    const open = renderShell(
      { ...emptySnapshot(), sessions: [session(2)], prompt: { head: prompt(), count: 3 } },
      { parse },
    );
    expect(open).not.toContain("which key");
    expect(open.indexOf('role="dialog"')).toBeGreaterThan(-1);
    expect(open.indexOf('role="dialog"')).toBeLessThan(open.indexOf("TALK"));
    expect(text(open)).toContain("1 of 3 · s2 · Run npm test?");

    const closed = renderShell({ ...emptySnapshot(), sessions: [session(2)] }, { parse });
    expect(closed).toContain("which key");
    expect(closed.indexOf("which key")).toBeLessThan(closed.indexOf("TALK"));
  });
});

describe("WhichKey (US-05, S-04)", () => {
  it("test_s04_lists_a_partial_parses_next_keys_with_name_and_owning_graft", () => {
    const html = renderToStaticMarkup(
      <WhichKey
        parse={{
          status: "partial",
          count: 1,
          next: [
            { key: "s", name: "session", owner: "core" },
            { key: "a", name: "attempts", owner: "race" },
          ],
        }}
      />,
    );
    expect(text(html)).toBe("s session (core) · a attempts (race)");
  });

  it("renders nothing for a complete, invalid or empty parse", () => {
    expect(renderToStaticMarkup(<WhichKey parse={undefined} />)).toBe("");
    expect(renderToStaticMarkup(<WhichKey parse={{ status: "invalid", hint: "x" }} />)).toBe("");
    const empty = <WhichKey parse={{ status: "partial", count: 1, next: [] }} />;
    expect(renderToStaticMarkup(empty)).toBe("");
  });
});

describe("TopBar, widgets and tabs (US-11, US-14)", () => {
  const widgets = [
    { id: "w1", graft: "git", slot: "topbar" as const, element: <b>TOPW</b> },
    { id: "w2", graft: "race", slot: "statusline" as const, element: <b>STATW</b> },
  ];

  it("test_us14_draws_graft_widgets_each_in_its_own_slot", () => {
    const top = renderToStaticMarkup(<TopBar usage={{}} widgets={widgets} />);
    expect(top).toContain("TOPW");
    expect(top).not.toContain("STATW");
    const stat = renderToStaticMarkup(
      <Statusline mode="TALK" counts="1 session" widgets={widgets} />,
    );
    expect(stat).toContain("STATW");
    expect(stat).not.toContain("TOPW");
  });

  it("shows the 5h and weekly bars, or unknown when a window is missing", () => {
    const html = renderToStaticMarkup(
      <TopBar usage={{ fiveHour: { utilization: 0.42, resetsAt: "2026-01-01T12:00:00.000Z" } }} />,
    );
    expect(text(html)).toContain("5h");
    expect(text(html)).toContain("42%");
    expect(text(html)).toContain("week unknown");
  });

  it("test_us11_shows_every_session_as_a_tab_and_marks_the_focused_one", () => {
    const html = renderToStaticMarkup(
      <SessionTabs
        sessions={[session(1), session(2, "cryo"), session(3)]}
        focused="notes-app/s2"
      />,
    );
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(text(html)).toBe("s1s2 · cryos3");
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  });

  it("the shell shows tabs only on session screens", () => {
    const snap = { ...emptySnapshot(), sessions: [session(1), session(2)] };
    expect(renderShell(snap, { tabs: true })).toContain('role="tablist"');
    expect(renderShell(snap, { tabs: false })).not.toContain('role="tablist"');
  });
});

describe("Panel host (US-30, S-15, G-01)", () => {
  it("test_s15_a_panel_that_throws_shows_its_failure_in_its_own_box_and_the_rest_keeps_working", () => {
    quietly(() => {
      const html = renderToStaticMarkup(
        <PanelHost
          panels={[
            { id: "a", graft: "race", title: "Race", element: <Boom /> },
            { id: "b", graft: "git", title: "Git", element: <i>git is fine</i>, focused: true },
          ]}
        />,
      );
      expect(html).toContain("race panel failed: kaput");
      expect(html).toContain("git is fine");
      expect(html).not.toContain("git panel failed");
    });
  });

  it("a widget that throws is fenced the same way, and an empty host says so", () => {
    quietly(() => {
      const html = renderToStaticMarkup(
        <GraftBoundary graft="git" kind="widget">
          <Boom />
        </GraftBoundary>,
      );
      expect(html).toContain("git widget failed: kaput");
    });
    expect(renderToStaticMarkup(<PanelHost panels={[]} />)).toContain("no panels open");
  });

  it("a thrown non-Error value is reported by its text", () => {
    function Throws(): never {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "plain";
    }
    quietly(() => {
      const html = renderToStaticMarkup(
        <GraftBoundary graft="x" kind="panel">
          <Throws />
        </GraftBoundary>,
      );
      expect(html).toContain("x panel failed: plain");
    });
  });
});

describe("graft-ui exports", () => {
  it("exports the components and the theme", () => {
    const names = ["Grid", "Box", "Text", "Chip", "Bar", "List", "Table", "Canvas", "theme"];
    for (const name of names) expect((ui as Record<string, unknown>)[name], name).toBeDefined();
  });
});
