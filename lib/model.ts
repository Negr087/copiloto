import type { LanguageModel } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import { createAnthropic } from '@ai-sdk/anthropic';

/**
 * Model resolution for the whole app.
 *
 * Auth is chosen automatically from the environment. All getters read
 * `process.env` LAZILY (at call time, not module load) so that credentials
 * saved at runtime by the /setup flow take effect on the next request without
 * a server restart.
 *
 *  - Subscription mode (default): routes through the local Claude Code CLI.
 *    Auth comes from either CLAUDE_CODE_OAUTH_TOKEN (a long-lived token from
 *    `claude setup-token` or the in-app /setup flow) or an existing local
 *    `claude auth login`. The provider spawns the CLI, which inherits this
 *    process's env — so setting CLAUDE_CODE_OAUTH_TOKEN here is enough.
 *    Node.js runtime only (spawns a subprocess); NOT edge/serverless.
 *    NOTE: Claude Code runs its own tools; AI SDK / Mastra tools are not bridged.
 *
 *  - API-key mode: set ANTHROPIC_API_KEY → calls go over HTTP via
 *    @ai-sdk/anthropic. Works anywhere and fully supports tool-calling.
 */

const DEFAULT_MODEL_ID = 'claude-opus-4-8';

/** Effective model id: MODEL_ID env override, else the default. */
export function getModelId(): string {
  return process.env.MODEL_ID?.trim() || DEFAULT_MODEL_ID;
}

/** True when no ANTHROPIC_API_KEY is present → use the Claude Code subscription. */
export function useSubscription(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

/** Whether a usable credential is configured for the active mode. */
export function isAuthConfigured(): boolean {
  if (!useSubscription()) return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  // Subscription mode: a token here, or a local `claude auth login`, works.
  return Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim());
}

/** Human-readable label for the active mode (for logs / the UI). */
export function modeLabel(): string {
  return useSubscription()
    ? 'suscripción (Claude Code)'
    : 'API key (@ai-sdk/anthropic)';
}

/**
 * Resolve a Vercel AI SDK language model for the current auth mode.
 * `claudeCode()` accepts full ids ("claude-opus-4-8") or short names
 * ("opus" | "sonnet" | "haiku" | "fable"); `@ai-sdk/anthropic` wants the full id.
 */
export function getModel(modelId: string = getModelId()): LanguageModel {
  if (useSubscription()) {
    // The spawned CLI inherits process.env.CLAUDE_CODE_OAUTH_TOKEN, if set.
    return claudeCode(modelId);
  }
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic(modelId);
}
