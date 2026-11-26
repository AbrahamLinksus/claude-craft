/** Repo identity (LLD 5.2): `repoKey` follows the remote, `repoId` is a folder slug. */

export interface RepoKeyInput {
  /** `origin` URL, or null/undefined when the repo has no remote. */
  remoteUrl?: string | null | undefined;
  /** Absolute path of the main checkout. */
  path: string;
  /** Lowercase paths (Windows). Default true: Windows is the first platform. */
  caseInsensitivePath?: boolean;
}

const SCP_LIKE = /^(?:[\w.-]+@)?([\w.-]+):(?!\/\/)(.+)$/;
const URL_LIKE = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/]*@)?([^/:]+)(?::(\d+))?(\/.*)?$/i;

function stripTail(path: string): string {
  return path
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
}

function normalizeUrlForm(match: RegExpExecArray): string {
  const [, scheme = "", host = "", port, path = ""] = match;
  const keepPort = port !== undefined && !scheme.toLowerCase().startsWith("ssh");
  const hostPart = keepPort ? `${host.toLowerCase()}:${port}` : host.toLowerCase();
  return `${hostPart}${stripTail(path)}`;
}

/** Normalize an `origin` URL to `host/path` (lowercase host, no user@, no .git, no trailing /). */
export function normalizeRemoteUrl(url: string): string {
  const trimmed = url.trim();
  const parsed = URL_LIKE.exec(trimmed);
  if (parsed) return normalizeUrlForm(parsed);
  const scp = SCP_LIKE.exec(trimmed);
  if (scp?.[1] !== undefined && scp[2] !== undefined) {
    return `${scp[1].toLowerCase()}/${stripTail(scp[2].replace(/^\/+/, ""))}`;
  }
  return stripTail(trimmed);
}

export function repoKey(input: RepoKeyInput): string {
  const remote = input.remoteUrl?.trim();
  if (remote !== undefined && remote !== "") return normalizeRemoteUrl(remote);
  const lower = input.caseInsensitivePath ?? true;
  return `path:${lower ? input.path.toLowerCase() : input.path}`;
}

/** Folder name to slug: lowercase letters, digits and single dashes. */
export function slugify(folderName: string): string {
  const slug = folderName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "repo" : slug;
}

/**
 * Pick the repoId for `repoKey`: its existing id, else the slug, else slug-2, slug-3…
 * `known` maps repoKey to repoId for every repo already registered.
 */
export function assignRepoId(
  folderName: string,
  key: string,
  known: Readonly<Record<string, string>>,
): string {
  const existing = known[key];
  if (existing !== undefined) return existing;
  const taken = new Set(Object.values(known));
  const slug = slugify(folderName);
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${String(n)}`)) n += 1;
  return `${slug}-${String(n)}`;
}
