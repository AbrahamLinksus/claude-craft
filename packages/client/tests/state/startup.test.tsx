import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RepoView } from "@craft/protocol";
import { MacroRecorder, ModeMachine, parseSentence } from "../../src/renderer/input/index.ts";
import { clampIndex, startupAction } from "../../src/renderer/screens/startup/startup-keys.ts";
import { StartupView } from "../../src/renderer/screens/startup/startup-view.tsx";
import { StatusLine } from "../../src/renderer/screens/startup/status-line.tsx";
import { baseCss, cells, color, rows, themeVariables } from "../../src/renderer/theme/css.ts";
import { cell, colors, fontFamily } from "../../src/renderer/theme/tokens.ts";

const repo = (name: string, extra: Partial<RepoView> = {}): RepoView => ({
  repoId: name,
  repoKey: `key-${name}`,
  path: `C:/work/${name}`,
  name,
  lastOpened: "t",
  ...extra,
});

describe("Startup screen (US-01)", () => {
  it("test_us01_with_no_repos_it_shows_the_empty_list_the_open_folder_line_and_the_hint", () => {
    const html = renderToStaticMarkup(<StartupView repos={[]} selected={0} error={undefined} />);
    expect(html).toContain("Craft");
    expect(html).toContain("recent repos");
    expect(html).toContain("no repos yet");
    expect(html).toContain("o open folder…");
    expect(html).toContain("j/k move");
  });

  it("lists recent repos with a number, highlights the selected one and flags a missing folder", () => {
    const html = renderToStaticMarkup(
      <StartupView
        repos={[repo("api"), repo("notes", { missing: true })]}
        selected={1}
        error="not a git repo: C:/x"
      />,
    );
    expect(html).toContain("C:/work/api");
    expect(html).toContain("missing · x forget");
    expect(html).toContain("&gt;");
    expect(html).toContain("not a git repo: C:/x");
    expect(html).not.toContain("no repos yet");
  });

  it("uses theme tokens for colour and cell-sized spacing, never raw colours", () => {
    const html = renderToStaticMarkup(<StartupView repos={[]} selected={0} error={undefined} />);
    expect(html).toContain("var(--c-accent)");
    expect(html).toContain("var(--cell-w)");
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("the statusline shows connected, connecting and reconnecting with the reason", () => {
    const render = (
      status: "connected" | "connecting" | "reconnecting",
      message?: string,
    ): string =>
      renderToStaticMarkup(
        <StatusLine link={message === undefined ? { status } : { status, message }} />,
      );
    expect(render("connected")).toContain("connected");
    expect(render("connecting")).toContain("connecting…");
    const down = render("reconnecting", "Craft is falling behind on events");
    expect(down).toContain("reconnecting…");
    expect(down).toContain("falling behind");
  });
});

describe("Startup keys", () => {
  const repos = [repo("a"), repo("b"), repo("c")];

  it("j and k move, o opens a folder, enter and numbers pick", () => {
    expect(startupAction("j", 0, repos)).toEqual({ type: "move", delta: 1 });
    expect(startupAction("k", 0, repos)).toEqual({ type: "move", delta: -1 });
    expect(startupAction("o", 0, repos)).toEqual({ type: "open-folder" });
    expect(startupAction("Enter", 2, repos)).toEqual({ type: "pick", index: 2 });
    expect(startupAction("2", 0, repos)).toEqual({ type: "pick", index: 1 });
  });

  it("ignores enter on an empty list, numbers past the end and other keys", () => {
    expect(startupAction("Enter", 0, [])).toEqual({ type: "none" });
    expect(startupAction("9", 0, repos)).toEqual({ type: "none" });
    expect(startupAction("0", 0, repos)).toEqual({ type: "none" });
    expect(startupAction("z", 0, repos)).toEqual({ type: "none" });
  });

  it("keeps the highlight inside the list", () => {
    expect(clampIndex(0, -1, 3)).toBe(0);
    expect(clampIndex(2, 1, 3)).toBe(2);
    expect(clampIndex(1, 1, 3)).toBe(2);
    expect(clampIndex(5, 1, 0)).toBe(0);
  });
});

describe("theme tokens (LLD 13.4)", () => {
  it("every colour becomes a CSS variable and the cell sizes are whole pixels", () => {
    const vars = themeVariables();
    for (const name of Object.keys(colors)) {
      expect(Object.keys(vars).some((k) => k.startsWith("--c-"))).toBe(true);
      expect(Object.values(vars)).toContain(colors[name as keyof typeof colors]);
    }
    expect(vars["--c-surface-raised"]).toBe(colors.surfaceRaised);
    expect(vars["--cell-w"]).toBe(`${String(cell.widthPx)}px`);
    expect(Number.isInteger(cell.widthPx) && Number.isInteger(cell.heightPx)).toBe(true);
    expect(fontFamily).toContain("monospace");
    expect(baseCss).toContain("var(--c-surface)");
  });

  it("converts counts of cells and rows to calc expressions", () => {
    expect(cells(3)).toBe("calc(var(--cell-w) * 3)");
    expect(rows(2)).toBe("calc(var(--cell-h) * 2)");
    expect(color("onChip")).toBe("var(--c-on-chip)");
  });
});

describe("key router pieces (LLD 13.3)", () => {
  it("TALK passes keys; esc goes to LAB; i or enter returns to TALK", () => {
    const m = new ModeMachine();
    expect(m.onKey({ key: "a" })).toEqual({ type: "pass", key: "a" });
    expect(m.onKey({ key: "Escape" })).toEqual({ type: "mode", mode: "LAB" });
    expect(m.onKey({ key: "j" })).toEqual({ type: "pass", key: "j" });
    expect(m.onKey({ key: "i" })).toEqual({ type: "mode", mode: "TALK" });
    m.onKey({ key: "Escape" });
    expect(m.onKey({ key: "Enter" })).toEqual({ type: "mode", mode: "TALK" });
  });

  it("records and replays a macro in registers a to z only", () => {
    const macros = new MacroRecorder();
    macros.start("A");
    macros.push("x");
    macros.stop();
    expect(macros.replay("A")).toEqual([]);
    macros.start("q");
    macros.push("3fs");
    macros.push("u");
    macros.stop();
    macros.stop();
    expect(macros.replay("q")).toEqual(["3fs", "u"]);
    expect(macros.replay("z")).toEqual([]);
  });

  it("exports the shared sentence parser", () => {
    expect(
      parseSentence("1", { verbs: [], objects: [], bindings: [], commands: [], panelKeys: [] })
        .status,
    ).toBe("partial");
  });
});
