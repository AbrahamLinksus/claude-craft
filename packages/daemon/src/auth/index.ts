import type { AnyCommandHandler, SignInMethod, SignInStatus } from "@craft/protocol";
import { notBuilt } from "../domain/index.ts";
import { DEFAULT_SIGN_IN } from "./default.ts";

export { DEFAULT_SIGN_IN };
export type { SignInMethod, SignInStatus };

/** Environment handed to the agent child process. */
export type AuthEnv = Readonly<Record<string, string>>;

export interface AuthService {
  status(): SignInStatus;
  setMethod(m: SignInMethod): Promise<void>;
  /** Validates /^sk-ant-/, saves credentials.json, never echoes. */
  setApiKey(key: string): Promise<void>;
  /** Throws CraftError AUTH_MISSING. */
  envFor(): AuthEnv;
  /** claude-login only. */
  openClaudeLogin(): Promise<void>;
}

export interface AuthDeps {
  /** `settings.signIn.method`; undefined means the default. */
  configuredMethod: () => SignInMethod | undefined;
}

/** Placeholder until the sign-in task: reports the configured method, everything else throws. */
export function createAuthService(deps: AuthDeps): AuthService {
  return notBuilt<AuthService>("auth", {
    status: () => ({ method: deps.configuredMethod() ?? DEFAULT_SIGN_IN, ready: "unknown" }),
  });
}

export function commands(auth: AuthService): AnyCommandHandler[] {
  return [
    { name: "signin.setMethod", run: (args) => auth.setMethod(args.method) },
    { name: "signin.setApiKey", run: (args) => auth.setApiKey(args.key) },
    { name: "signin.openClaudeLogin", run: () => auth.openClaudeLogin() },
  ];
}
