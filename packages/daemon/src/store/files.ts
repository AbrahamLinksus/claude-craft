import { z } from "zod";
import {
  CraftError,
  SETTINGS_VERSION,
  defaultSettings,
  sessionKeySchema,
  sessionStateSchema,
  cryoSchema,
  settingsSchema,
  type Settings,
} from "@craft/protocol";
import { migrationsFor } from "./migrations/registry.ts";
import type { CraftPaths } from "./paths.ts";
import type { StoreFile } from "./store.ts";

const v1 = z.literal(1).default(1);

/** Build a version-1 file definition: schema, defaults and its migration slot (`migrations/<key>-*`). */
function file<T extends { schema: number }>(
  key: string,
  path: string,
  schema: z.ZodType<T>,
  defaults: () => T,
): StoreFile<T> {
  return { path, schema, version: 1, defaults, migrations: migrationsFor(key) };
}

export const graftEntrySchema = z.object({
  installed: z.boolean().default(true),
  dose: z.number().int().min(0).max(5),
  version: z.string(),
  acceptedCapabilities: z.array(z.string()).default([]),
  settings: z.record(z.string(), z.unknown()).default({}),
});
const graftsSchema = z.object({
  schema: v1,
  grafts: z.record(z.string(), graftEntrySchema).default({}),
});
export type GraftsFile = z.infer<typeof graftsSchema>;

export const repoSettingsSchema = z.object({
  push: z.enum(["yes", "no"]).nullable().default(null),
  testCmd: z.string().optional(),
  lintCmd: z.string().optional(),
});
const repoSettingsFileSchema = z.object({
  schema: v1,
  repos: z.record(z.string(), repoSettingsSchema).default({}),
});
export type RepoSettingsFile = z.infer<typeof repoSettingsFileSchema>;

const credentialsSchema = z.object({ schema: v1, apiKey: z.string().optional() });
export type CredentialsFile = z.infer<typeof credentialsSchema>;

export const knownRepoSchema = z.object({
  repoId: z.string(),
  path: z.string(),
  name: z.string(),
  lastOpened: z.string(),
  nextN: z.number().int().min(1).default(1),
  missing: z.boolean().optional(),
});
const reposStateSchema = z.object({
  schema: v1,
  repos: z.record(z.string(), knownRepoSchema).default({}),
});
export type ReposStateFile = z.infer<typeof reposStateSchema>;

export const undoEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(["merge", "prune", "pick"]),
  owner: z.string(),
  label: z.string(),
  repoId: z.string(),
  createdAt: z.string(),
  pushCheck: z.array(z.string()),
  payload: z.unknown(),
});
const undoSchema = z.object({ schema: v1, entries: z.array(undoEntrySchema).max(20).default([]) });
export type UndoFile = z.infer<typeof undoSchema>;

const childrenSchema = z.object({
  schema: v1,
  children: z
    .array(
      z.object({ pid: z.number().int(), createdAt: z.string(), sid: sessionKeySchema.optional() }),
    )
    .default([]),
});
export type ChildrenFile = z.infer<typeof childrenSchema>;

const daemonInfoSchema = z.object({
  schema: v1,
  pid: z.number().int(),
  version: z.string(),
  epoch: z.number(),
  startedAt: z.string(),
});
export type DaemonInfoFile = z.infer<typeof daemonInfoSchema>;

export const sessionRecordSchema = z.object({
  schema: v1,
  sid: sessionKeySchema,
  repoId: z.string(),
  n: z.number().int(),
  branch: z.string(),
  worktree: z.string(),
  model: z.string(),
  pool: z.enum(["own", "team"]),
  sdkSessionId: z.string().optional(),
  state: sessionStateSchema,
  cryo: cryoSchema.optional(),
  turn: z.number().int(),
  midTurn: z.boolean(),
  parent: z.object({ sid: sessionKeySchema, turn: z.number().int() }).optional(),
  history: z.enum(["repo", "home"]),
  createdAt: z.string(),
  lastActiveAt: z.string(),
});
export type SessionRecordFile = z.infer<typeof sessionRecordSchema>;

/** One line of `usage/history-YYYY-MM.jsonl` (LLD 15.3). */
export const usageLineSchema = z.object({
  ts: z.string(),
  sid: sessionKeySchema.optional(),
  fiveHour: z.number().optional(),
  sevenDay: z.number().optional(),
  tokens: z.number().optional(),
  costUsd: z.number().optional(),
});
export type UsageLine = z.infer<typeof usageLineSchema>;

/** Every JSON file of LLD 5.1 as a `StoreFile`. */
export interface StoreFiles {
  settings: StoreFile<Settings>;
  grafts: StoreFile<GraftsFile>;
  repoSettings: StoreFile<RepoSettingsFile>;
  credentials: StoreFile<CredentialsFile>;
  repos: StoreFile<ReposStateFile>;
  undo: StoreFile<UndoFile>;
  children: StoreFile<ChildrenFile>;
  daemonInfo: StoreFile<DaemonInfoFile>;
  /** One session record file, `state/sessions/<repoId>/s<n>.json`. */
  sessionRecord(repoId: string, n: number): StoreFile<SessionRecordFile>;
}

export function storeFiles(paths: CraftPaths): StoreFiles {
  return {
    settings: {
      path: paths.settings,
      schema: settingsSchema,
      version: SETTINGS_VERSION,
      defaults: defaultSettings,
      migrations: migrationsFor("settings"),
    },
    grafts: file("grafts", paths.grafts, graftsSchema, () => ({ schema: 1, grafts: {} })),
    repoSettings: file("repo-settings", paths.repoSettings, repoSettingsFileSchema, () => ({
      schema: 1,
      repos: {},
    })),
    credentials: {
      ...file("credentials", paths.credentials, credentialsSchema, () => ({ schema: 1 })),
      mode: 0o600,
    },
    repos: file("repos", paths.repos, reposStateSchema, () => ({ schema: 1, repos: {} })),
    undo: file("undo", paths.undo, undoSchema, () => ({ schema: 1, entries: [] })),
    children: file("children", paths.children, childrenSchema, () => ({ schema: 1, children: [] })),
    daemonInfo: file("daemon-info", paths.daemonInfo, daemonInfoSchema, () => ({
      schema: 1,
      pid: 0,
      version: "",
      epoch: 0,
      startedAt: "",
    })),
    sessionRecord: (repoId, n) =>
      file("session-record", paths.sessionRecord(repoId, n), sessionRecordSchema, () => {
        throw new CraftError("INTERNAL", {}, { missing: `${repoId}/s${String(n)}` });
      }),
  };
}
