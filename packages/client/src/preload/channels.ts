/** Names of the messages between the window and the main process. */
export const CHANNELS = {
  send: "craft:send",
  message: "craft:message",
  linkState: "craft:link-state",
  ready: "craft:ready",
  pickFolder: "craft:pick-folder",
  log: "craft:log",
} as const;
