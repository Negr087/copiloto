import type { LanguageModel } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import { createAnthropic } from '@ai-sdk/anthropic';

/**
 * Model resolution for the whole app.
 *
 * Two auth modes, chosen automatically by whether ANTHROPIC_API_KEY is set:
 *
 *  - Subscription mode (default, no key): routes through the local Claude Code
 *    CLI, which uses your Claude Pro/Max login. Free for local development, but
 *    it spawns a CLI subprocess — so it only works in the Node.js runtime, never
 *    on edge/serverless. NOTE: in this mode Claude Code runs its *own* tools; AI
 *    SDK / Mastra tool definitions are NOT bridged (see src/mastra/agents).
 *
 *  - API-key mode: set ANTHROPIC_API_KEY and calls go over HTTP via
 *    @ai-sdk/anthropic. Works anywhere (edge, serverless, CI) and fully supports
 *    AI SDK tool-calling. This is the mode you deploy with.
 *
 * Everything else in the app depends only on `getModel()`, so switching modes is
 * a single environment decision.
 */

/** Default full model id. Override per-deploy with the MODEL_ID env var. */
const DEFAULT_MODEL_ID = 'claude-opus-4-8';

/** Effective model id: MODEL_ID env override, else the default. */
export const MODEL_ID = process.env.MODEL_ID?.trim() || DEFAULT_MODEL_ID;

/** True when no ANTHROPIC_API_KEY is present → use the Claude Code subscription. */
export const USE_SUBSCRIPTION = !process.env.ANTHROPIC_API_KEY;

/**
 * Resolve a Vercel AI SDK language model for the current auth mode.
 * `claudeCode()` accepts full ids ("claude-opus-4-8") or short names
 * ("opus" | "sonnet" | "haiku"); `@ai-sdk/anthropic` wants the full id.
 */
export function getModel(modelId: string = MODEL_ID): LanguageModel {
  if (USE_SUBSCRIPTION) {
    return claudeCode(modelId);
  }
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic(modelId);
}

/** Human-readable label for the active mode (handy for logs / the UI). */
export const MODE_LABEL = USE_SUBSCRIPTION
  ? 'suscripción (Claude Code)'
  : 'API key (@ai-sdk/anthropic)';
