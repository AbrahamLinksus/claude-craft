export const PROTOCOL_VERSION = 1;
export const CRAFT_VERSION = "0.0.0";

/** One NDJSON line may not exceed 1 MB (LLD 1.3). */
export const MAX_LINE_BYTES = 1_048_576;
export const HANDSHAKE_TIMEOUT_MS = 5_000;
export const STREAM_FLUSH_MS = 33;
export const STREAM_RING_SIZE = 20_000;
export const NONCE_BYTES = 32;
