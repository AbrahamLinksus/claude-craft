/** Reconnect backoff (LLD 2.2): 250 ms doubling up to 5 s. */
export const BACKOFF_START_MS = 250;
export const BACKOFF_MAX_MS = 5_000;
/** Connect refused this long: start the background worker again (LLD 2.2). */
export const RELAUNCH_AFTER_MS = 10_000;
/** After a launch, how long the launcher keeps trying to connect (LLD 2.3). */
export const LAUNCH_WAIT_MS = 10_000;
export const LAUNCH_POLL_MS = 100;
/** Token mismatches in a row before the link says the connection name is taken. */
export const IMPOSTOR_STRIKES = 5;
