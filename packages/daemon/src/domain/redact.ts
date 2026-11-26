/** Redaction of keys and secrets in session logs of "yes" repos (LLD 4.2). */
export const HIDDEN = "[hidden]";

const NAMED_SECRET =
  /(\b[\w-]*(?:api[_-]?key|secret|password|passwd|token)"?\s*[=:]\s*"?)[^\s"']{4,}/gi;

/** Whole-match patterns, applied in order before the name=value rule. */
const WHOLE_MATCH: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /sk-ant-[\w-]{10,}/g,
  /sk-(?:live|test|proj)?-?\w{16,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /gh[pousr]_\w{30,}/g,
  /xox[abposr]-[\w-]{10,}/g,
  /eyJ[\w-]+\.[\w-]+\.[\w-]+/g,
];

export function redactString(text: string): string {
  const whole = WHOLE_MATCH.reduce((acc, re) => acc.replace(re, HIDDEN), text);
  return whole.replace(NAMED_SECRET, `$1${HIDDEN}`);
}

/** Redact every string field of a JSON-like value, recursively; returns a new value. */
export function redactDeep(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)]));
  }
  return value;
}
