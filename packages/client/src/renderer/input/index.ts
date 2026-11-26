/**
 * Key routing, first match wins (LLD 13.3). The signatures here are fixed; later tasks fill in
 * the routing steps (prompt, `:` line, panel keys) behind them without changing these exports.
 */
export { parseSentence } from "@craft/protocol";
export type { NextKey, ParseResult } from "@craft/protocol";

export type Mode = "TALK" | "LAB";

export interface KeyEvent {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

/** What the window should do with a key. */
export type Action =
  { type: "none" } | { type: "mode"; mode: Mode } | { type: "pass"; key: string };

/** TALK or LAB: esc leaves TALK, i or enter leaves LAB (US-03). */
export class ModeMachine {
  mode: Mode = "TALK";

  onKey(e: KeyEvent): Action {
    if (this.mode === "TALK") {
      if (e.key !== "Escape") return { type: "pass", key: e.key };
      this.mode = "LAB";
      return { type: "mode", mode: "LAB" };
    }
    if (e.key === "i" || e.key === "Enter") {
      this.mode = "TALK";
      return { type: "mode", mode: "TALK" };
    }
    return { type: "pass", key: e.key };
  }
}

const REGISTERS = /^[a-z]$/;

/** Macro registers a to z (US-06); this keeps them in memory, persistence comes with the LAB task. */
export class MacroRecorder {
  private readonly registers = new Map<string, string[]>();
  private recording: { reg: string; keys: string[] } | undefined;

  start(reg: string): void {
    if (!REGISTERS.test(reg)) return;
    this.recording = { reg, keys: [] };
  }

  push(keys: string): void {
    this.recording?.keys.push(keys);
  }

  stop(): void {
    if (this.recording === undefined) return;
    this.registers.set(this.recording.reg, this.recording.keys);
    this.recording = undefined;
  }

  replay(reg: string): string[] {
    return [...(this.registers.get(reg) ?? [])];
  }
}
