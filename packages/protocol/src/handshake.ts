import { NONCE_BYTES } from "./version.ts";

/** Who is proving the token: the daemon answers "daemon:", the client "client:" (LLD 1.3). */
export type ProofRole = "daemon" | "client";

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 32 random bytes, base64. */
export function randomNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** `HMAC-SHA256(token, role + ":" + nonce)` as lowercase hex. */
export async function proofFor(token: string, role: ProofRole, nonce: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(`${role}:${nonce}`));
  return toHex(new Uint8Array(mac));
}

/** Constant-time comparison of two proofs. */
export function proofsEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
