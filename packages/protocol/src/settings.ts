import { z } from "zod";

export const SETTINGS_VERSION = 1;

export const signInMethodSchema = z.enum(["api-key", "claude-login"]);
export type SignInMethod = z.infer<typeof signInMethodSchema>;

export const PERMISSION_MODES = ["default", "acceptEdits", "plan", "bypassPermissions"] as const;
export const permissionModeSchema = z.enum(PERMISSION_MODES);
export type PermissionModeSetting = z.infer<typeof permissionModeSchema>;

/** `signIn.method` unset means the daemon's `DEFAULT_SIGN_IN` (auth/default.ts). */
export const settingsSchema = z.object({
  schema: z.literal(SETTINGS_VERSION).default(SETTINGS_VERSION),
  signIn: z.object({ method: signInMethodSchema.optional() }).default({}),
  sessions: z
    .object({
      cap: z.number().int().min(1).default(5),
      teamCap: z.number().int().min(1).default(8),
      offlineRetryMinutes: z.number().min(1).default(5),
      defaultModel: z.string().min(1).default("sonnet"),
    })
    .default({ cap: 5, teamCap: 8, offlineRetryMinutes: 5, defaultModel: "sonnet" }),
  agent: z
    .object({
      permissionMode: permissionModeSchema.default("acceptEdits"),
      settingSources: z.array(z.string()).default(["project"]),
    })
    .default({ permissionMode: "acceptEdits", settingSources: ["project"] }),
  usage: z
    .object({
      thresholds: z.array(z.number()).default([60, 85]),
      staleMinutes: z.number().min(1).default(5),
    })
    .default({ thresholds: [60, 85], staleMinutes: 5 }),
  race: z.object({ review: z.boolean().default(false) }).default({ review: false }),
  ui: z
    .object({ fleetLayout: z.enum(["tiling", "parallel"]).default("tiling") })
    .default({ fleetLayout: "tiling" }),
});

export type Settings = z.infer<typeof settingsSchema>;
/** Settings shown to the client: no secrets live in this file. */
export type PublicSettings = Settings;

export function defaultSettings(): Settings {
  return settingsSchema.parse({});
}
