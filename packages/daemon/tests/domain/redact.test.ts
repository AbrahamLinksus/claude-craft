import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HIDDEN, redactDeep, redactString } from "../../src/domain/index.ts";

const here = import.meta.dirname;

/** Fake secrets are assembled here so no secret-shaped text sits in a tracked file. */
function fakeSecrets(): Record<string, string> {
  return {
    SK_LIVE: "sk-" + "live-" + "4f9a8b7c6d5e4f3a2b1c",
    SK_ANT: "sk-" + "ant-" + "api03-abcdefghij1234567890",
    AKIA: "AK" + "IA" + "IOSFODNN7EXAMPLE",
    GH: "gh" + "p_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8",
    JWT: "ey" + "Jhbgcioi." + "eyJzdWIiOiIx." + "c2lnbmF0dXJl",
    PEM: "-----BEGIN " + "RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK\n-----END " + "RSA PRIVATE KEY-----",
  };
}

function filled(template: string): string {
  const secrets = fakeSecrets();
  return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => secrets[name] ?? "");
}

describe("redact", () => {
  it("test_g04_redaction_matches_the_golden_file", () => {
    const template = readFileSync(join(here, "redact.input.template.txt"), "utf8");
    const golden = readFileSync(join(here, "redact.golden.txt"), "utf8");
    const input = filled(template);
    expect(input).toContain("sk-live-"); // the input really holds the fake key
    expect(redactString(input)).toBe(golden);
  });

  it("test_g04_api_key_sk_live_becomes_api_key_hidden", () => {
    expect(redactString("API_KEY=" + "sk-" + "live-4f9a8b7c6d5e4f3a2b1c")).toBe("API_KEY=[hidden]");
    expect(HIDDEN).toBe("[hidden]");
  });

  it("redacts every string inside nested values and leaves other values alone", () => {
    const key = "sk-" + "live-4f9a8b7c6d5e4f3a2b1c";
    const out = redactDeep({
      a: `x ${key}`,
      n: 3,
      ok: true,
      list: [`API_KEY=${key}`, null],
      deep: { t: key },
    });
    expect(out).toEqual({
      a: "x [hidden]",
      n: 3,
      ok: true,
      list: ["API_KEY=[hidden]", null],
      deep: { t: "[hidden]" },
    });
  });
});
