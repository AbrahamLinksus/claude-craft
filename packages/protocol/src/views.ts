import { z } from "zod";
import { cryoSchema, openPromptSchema, sessionStateSchema } from "./events.ts";
import { sessionKeySchema } from "./ids.ts";
import { settingsSchema, signInMethodSchema } from "./settings.ts";

export const sessionViewSchema = z.object({
  sid: sessionKeySchema,
  repoId: z.string(),
  n: z.number().int(),
  branch: z.string(),
  worktree: z.string(),
  model: z.string(),
  pool: z.enum(["own", "team"]),
  state: sessionStateSchema,
  cryo: cryoSchema.optional(),
  turn: z.number().int(),
  parent: z.object({ sid: sessionKeySchema, turn: z.number().int() }).optional(),
  history: z.enum(["repo", "home"]),
  createdAt: z.string(),
  lastActiveAt: z.string(),
});
export type SessionView = z.infer<typeof sessionViewSchema>;

export const repoViewSchema = z.object({
  repoId: z.string(),
  repoKey: z.string(),
  path: z.string(),
  name: z.string(),
  lastOpened: z.string(),
  missing: z.boolean().optional(),
});
export type RepoView = z.infer<typeof repoViewSchema>;

export const verbDefSchema = z.object({
  key: z.string(),
  name: z.string(),
  owner: z.string(),
  objectless: z.boolean().optional(),
  countable: z.boolean().optional(),
});
export const objectDefSchema = z.object({ key: z.string(), name: z.string(), owner: z.string() });
export const grammarTableSchema = z.object({
  verbs: z.array(verbDefSchema),
  objects: z.array(objectDefSchema),
  bindings: z.array(
    z.object({ verb: z.string(), object: z.string().nullable(), owner: z.string() }),
  ),
  commands: z.array(z.object({ name: z.string(), title: z.string(), owner: z.string() })),
  panelKeys: z.array(
    z.object({
      panel: z.string(),
      owner: z.string(),
      keys: z.array(z.object({ key: z.string(), label: z.string() })),
    }),
  ),
});
export type GrammarTable = z.infer<typeof grammarTableSchema>;
export type VerbDef = z.infer<typeof verbDefSchema>;
export type ObjectDef = z.infer<typeof objectDefSchema>;

export const graftViewSchema = z.object({
  name: z.string(),
  title: z.string(),
  version: z.string(),
  status: z.enum(["loaded", "disabled", "error", "awaiting-leaflet", "available"]),
  dose: z.number().int(),
  doses: z.record(z.string(), z.string()).optional(),
  message: z.string().optional(),
});
export type GraftView = z.infer<typeof graftViewSchema>;

export const signInStatusSchema = z.object({
  method: signInMethodSchema.nullable(),
  ready: z.enum(["yes", "no", "unknown"]),
  keyHint: z.string().optional(),
});
export type SignInStatus = z.infer<typeof signInStatusSchema>;

export const snapshotSchema = z.object({
  sessions: z.array(sessionViewSchema),
  repos: z.array(repoViewSchema),
  grammar: grammarTableSchema,
  prompt: z.object({ head: openPromptSchema.optional(), count: z.number().int() }),
  panels: z.record(z.string(), z.unknown()),
  grafts: z.array(graftViewSchema),
  usage: z.unknown().optional(),
  settings: settingsSchema,
  signIn: signInStatusSchema,
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export function emptyGrammarTable(): GrammarTable {
  return { verbs: [], objects: [], bindings: [], commands: [], panelKeys: [] };
}
