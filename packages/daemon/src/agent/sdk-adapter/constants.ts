/** `ToolStarted.input` is capped at 8 KB (LLD 1.2). */
export const TOOL_INPUT_MAX_BYTES = 8 * 1024;
/** `ToolFinished.output` is capped at 16 KB (LLD 1.2). */
export const TOOL_OUTPUT_MAX_CHARS = 16 * 1024;
/** The hook may hold for as long as the owner takes; spike 2 proved 600 s with this explicit value. */
export const PRE_TOOL_USE_TIMEOUT_S = 86_400;
/** Input keys that carry file paths (LLD 6.2). */
export const PATH_KEYS = ["file_path", "notebook_path", "path"] as const;
