import type { AnyCommandHandler } from "../../../protocol/src/index.ts";
import { notBuilt } from "../domain/index.ts";

export interface StatusSummary {
  modified: number;
  staged: number;
  untracked: number;
  ahead: number;
  files: { path: string; code: string }[];
}

export interface BranchInfo {
  name: string;
  sha: string;
  mergedInto?: string;
  ahead: number;
  behind: number;
  lastCommitAt: string;
}

export interface GraphNode {
  sha: string;
  parents: string[];
  refs: string[];
  subject: string;
  at: string;
}

export interface FileDiffStat {
  path: string;
  added: number;
  removed: number;
}

export type GitRange = { base: string; head: string };
export type MergeOutcome = { ok: true; sha: string } | { ok: false; conflicts: string[] };

export interface GitRead {
  /** Porcelain v2 -z, excludes .craft/. */
  status(cwd: string): Promise<StatusSummary>;
  branches(repo: string): Promise<BranchInfo[]>;
  graph(repo: string, opts: { limit: number }): Promise<GraphNode[]>;
  changedFiles(repo: string, range: GitRange): Promise<string[]>;
  diff(repo: string, range: GitRange): Promise<{ files: FileDiffStat[]; patch: string }>;
  untracked(
    cwd: string,
  ): Promise<{ files: string[]; ignoredDirs: { path: string; count: number }[] }>;
  /** Reachable from any refs/remotes/*. */
  isPushed(repo: string, sha: string): Promise<boolean>;
  worktrees(repo: string): Promise<{ path: string; branch: string; locked: boolean }[]>;
  headSha(cwd: string): Promise<string>;
  remoteUrl(repo: string): Promise<string | null>;
  isRepo(path: string): Promise<boolean>;
  hasCommits(repo: string): Promise<boolean>;
}

export interface GitWrite {
  worktreeAdd(r: { repo: string; path: string; branch: string; fromSha: string }): Promise<void>;
  worktreeRemove(r: { repo: string; path: string }): Promise<void>;
  commitAll(r: { cwd: string; message: string }): Promise<string | null>;
  merge(r: { repo: string; branch: string; message: string }): Promise<MergeOutcome>;
  undoMerge(r: {
    repo: string;
    mergeSha: string;
  }): Promise<{ mode: "reset" | "revert"; sha: string }>;
  rebase(r: {
    cwd: string;
    onto: string;
  }): Promise<{ ok: true } | { ok: false; conflicts: string[] }>;
  branchDelete(r: { repo: string; branch: string }): Promise<{ sha: string }>;
  branchCreate(r: { repo: string; branch: string; sha: string }): Promise<void>;
}

export interface Git {
  read: GitRead;
  write: GitWrite;
}

/** Placeholder until the git task: every operation throws. */
export function createGit(): Git {
  return { read: notBuilt<GitRead>("git"), write: notBuilt<GitWrite>("git") };
}

export function commands(): AnyCommandHandler[] {
  return [];
}
