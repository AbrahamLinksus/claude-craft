import type { SignInMethod } from "../../../protocol/src/index.ts";

/**
 * The ONLY place the default sign-in lives (owner decision at LLD approval: subscription default).
 * Terms risk: Anthropic's terms restrict subscription login in third-party apps; if refused,
 * switch this to 'api-key'.
 */
export const DEFAULT_SIGN_IN: SignInMethod = "claude-login";
