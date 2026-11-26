/** Two creation times this close are the same process (probe output precision differs). */
export const CREATION_TOLERANCE_MS = 1_000;
/** Longest wait for a probe or kill helper (`powershell`, `ps`, `taskkill`). */
export const HELPER_TIMEOUT_MS = 15_000;
/** Win32 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. */
export const JOB_LIMIT_KILL_ON_CLOSE = 0x2000;
/** Win32 `JobObjectExtendedLimitInformation`. */
export const JOB_INFO_EXTENDED_LIMIT = 9;
/** `sizeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION)` on x64 and the offset of `LimitFlags` in it. */
export const JOB_INFO_SIZE = 144;
export const JOB_INFO_FLAGS_OFFSET = 16;
