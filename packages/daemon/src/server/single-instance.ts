import {
  HANDSHAKE_TIMEOUT_MS,
  PROTOCOL_VERSION,
  CRAFT_VERSION,
  encodeLine,
  parseDaemonLine,
  proofFor,
  proofsEqual,
  randomNonce,
} from "../../../protocol/src/index.ts";
import type { Clock } from "../domain/index.ts";
import { LineReader } from "./line-reader.ts";
import type { TokenFile } from "./token-file.ts";
import type { Transport } from "./transport.ts";

/** Who owns the connection name: a Craft daemon that proves the token, or something else. */
export type ProbeResult = "ours" | "foreign";

/**
 * Dial the address as a client and check the challenge proof with the existing token file.
 * Used when `listen` finds the name taken (LLD 2.3 single instance).
 */
export function probeDaemon(opts: {
  transport: Transport;
  tokenFile: TokenFile;
  clock: Clock;
}): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const socket = opts.transport.connect();
    const nonce = randomNonce();
    const reader = new LineReader();
    let settled = false;
    const finish = (result: ProbeResult): void => {
      if (settled) return;
      settled = true;
      cancel();
      socket.destroy();
      resolve(result);
    };
    const cancel = opts.clock.after(HANDSHAKE_TIMEOUT_MS, () => {
      finish("foreign");
    });
    for (const event of ["error", "close"]) {
      socket.on(event, () => {
        finish("foreign");
      });
    }
    socket.on("data", (chunk: Buffer) => {
      const read = reader.push(chunk);
      const line = read.ok ? read.lines[0] : undefined;
      if (line !== undefined) void verify(line, nonce, opts.tokenFile).then(finish);
    });
    socket.write(hello(nonce));
  });
}

function hello(nonce: string): string {
  const clientVersion = CRAFT_VERSION;
  return encodeLine({
    type: "hello",
    protocol: PROTOCOL_VERSION,
    clientVersion,
    clientNonce: nonce,
  });
}

async function verify(line: string, nonce: string, tokenFile: TokenFile): Promise<ProbeResult> {
  const msg = parseDaemonLine(line);
  const token = await tokenFile.read();
  if (!msg.ok || msg.value.type !== "challenge" || token === undefined) return "foreign";
  const expected = await proofFor(token, "daemon", nonce);
  return proofsEqual(expected, msg.value.proof) ? "ours" : "foreign";
}
