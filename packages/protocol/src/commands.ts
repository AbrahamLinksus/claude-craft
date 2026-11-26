import { z } from "zod";
import { sessionKeySchema } from "./ids.ts";
import { signInMethodSchema } from "./settings.ts";

export const targetSchema = z.object({
  sid: sessionKeySchema.optional(),
  branch: z.string().optional(),
  attempt: z.number().int().optional(),
  panel: z.string().optional(),
  selection: z.string().optional(),
});
export type Target = z.infer<typeof targetSchema>;

export const sentenceSchema = z.object({
  count: z.number().int().min(1),
  verb: z.string().min(1),
  object: z.string().nullable(),
  target: targetSchema,
});
export type Sentence = z.infer<typeof sentenceSchema>;

const none = z.object({}).strict();
const named = z.object({ name: z.string().min(1) });

/** Zod args of every command (LLD 1.3). */
export const COMMAND_ARGS = {
  "snapshot.get": none,
  "repo.list": none,
  "repo.open": z.object({ path: z.string().min(1) }),
  "repo.forget": z.object({ repoKey: z.string().min(1) }),
  "session.create": z.object({
    repoId: z.string().min(1),
    prompt: z.string().min(1),
    model: z.string().optional(),
  }),
  "session.prompt": z.object({ sid: sessionKeySchema, text: z.string().min(1) }),
  "sentence.run": z.object({
    count: z.number().int().min(1),
    verb: z.string().min(1),
    object: z.string().optional(),
    target: targetSchema.optional(),
  }),
  "command.run": z.object({ name: z.string().min(1), args: z.array(z.string()).optional() }),
  "prompt.answer": z.object({ promptId: z.string().min(1), key: z.string().min(1) }),
  "panel.action": z.object({
    graft: z.string().min(1),
    panel: z.string().min(1),
    action: z.unknown(),
  }),
  "settings.set": z.object({ path: z.string().min(1), value: z.unknown() }),
  "signin.setMethod": z.object({ method: signInMethodSchema }),
  "signin.setApiKey": z.object({ key: z.string().min(1) }),
  "signin.openClaudeLogin": none,
  "graft.setDose": named.extend({ dose: z.number().int().min(0).max(5) }),
  "graft.install": named,
  "graft.remove": named,
  "graft.acceptLeaflet": named,
  "daemon.restart": none,
} as const;

export type CommandName = keyof typeof COMMAND_ARGS;
export type CommandArgs<N extends CommandName> = z.infer<(typeof COMMAND_ARGS)[N]>;

export const COMMAND_NAMES = Object.keys(COMMAND_ARGS) as CommandName[];
export const commandNameSchema = z.enum(COMMAND_NAMES as [CommandName, ...CommandName[]]);

/** Context of one command call; `connId` identifies the client connection. */
export interface CmdCtx {
  connId: string;
}

export interface CommandHandler<N extends CommandName = CommandName> {
  name: N;
  run(args: CommandArgs<N>, ctx: CmdCtx): Promise<unknown>;
}

/** Any handler, erased to one type so modules can export `AnyCommandHandler[]`. */
export type AnyCommandHandler = {
  [N in CommandName]: CommandHandler<N>;
}[CommandName];
