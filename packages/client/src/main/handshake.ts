import {
  PROTOCOL_VERSION,
  encodeLine,
  proofFor,
  proofsEqual,
  randomNonce,
  type ClientMessage,
} from "../../../protocol/src/index.ts";
import { LinkClosedError, type MessageReader } from "./message-reader.ts";

/** The worker could not prove it holds the token (LLD 2.2: possible impostor). */
export class ImpostorError extends Error {
  constructor() {
    super("the worker's proof does not match the token");
    this.name = "ImpostorError";
  }
}

export interface HandshakeOptions {
  write(line: string): void;
  reader: MessageReader;
  readToken(): Promise<string | undefined>;
  clientVersion: string;
  /** Where the previous connection stopped, if there was one. */
  resume: { epoch: number; lastSeq: number } | undefined;
}

export interface HandshakeResult {
  epoch: number;
  daemonVersion: string;
}

function send(opts: HandshakeOptions, msg: ClientMessage): void {
  opts.write(encodeLine(msg));
}

/** hello, check the worker's proof, auth (LLD 2.2). Both sides prove the token. */
export async function clientHandshake(opts: HandshakeOptions): Promise<HandshakeResult> {
  const clientNonce = randomNonce();
  send(opts, {
    type: "hello",
    protocol: PROTOCOL_VERSION,
    clientVersion: opts.clientVersion,
    clientNonce,
  });
  const challenge = await opts.reader.next();
  if (challenge.type === "bye") throw new LinkClosedError(challenge.message);
  if (challenge.type !== "challenge") throw new LinkClosedError("expected a challenge");
  const token = await opts.readToken();
  if (token === undefined) throw new ImpostorError();
  const expected = await proofFor(token, "daemon", clientNonce);
  if (!proofsEqual(challenge.proof, expected)) throw new ImpostorError();
  const proof = await proofFor(token, "client", challenge.serverNonce);
  send(
    opts,
    opts.resume === undefined
      ? { type: "auth", proof }
      : { type: "auth", proof, resume: opts.resume },
  );
  return { epoch: challenge.epoch, daemonVersion: challenge.daemonVersion };
}
