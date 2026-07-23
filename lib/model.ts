import type { LanguageModel } from 'ai';
import { createGateway } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import { PROVIDERS, isProviderId, type ProviderId } from './providers';

/**
 * Model resolution. The provider is chosen by AI_PROVIDER and the model by
 * MODEL_ID (or the provider's default). Everything is read LAZILY (per request)
 * so config saved at runtime via /setup takes effect without a restart.
 *
 * Change the provider/model any time from /setup (or by editing .env).
 */

/** Active provider: AI_PROVIDER if valid, else inferred, else subscription. */
export function getProvider(): ProviderId {
  const p = process.env.AI_PROVIDER?.trim();
  if (isProviderId(p)) return p;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'subscription';
}

/** Effective model id: MODEL_ID override, else the provider's default. */
export function getModelId(provider: ProviderId = getProvider()): string {
  return process.env.MODEL_ID?.trim() || PROVIDERS[provider].defaultModel;
}

/** Whether the active provider's credential is present. */
export function isAuthConfigured(provider: ProviderId = getProvider()): boolean {
  return Boolean(process.env[PROVIDERS[provider].keyEnv]?.trim());
}

/** Human-readable label for the active provider. */
export function modeLabel(provider: ProviderId = getProvider()): string {
  return PROVIDERS[provider].label;
}

/** Resolve a Vercel AI SDK language model for the active provider. */
export function getModel(modelId?: string): LanguageModel {
  const provider = getProvider();
  const id = modelId ?? getModelId(provider);

  switch (provider) {
    case 'subscription': {
      // The provider's `env` REPLACES the spawned CLI's environment. Pass the
      // full env MINUS ANTHROPIC_API_KEY (which would outrank the OAuth token),
      // so the subscription is always used.
      const { ANTHROPIC_API_KEY: _omit, ...env } = process.env;
      void _omit;
      return claudeCode(id, { env });
    }
    case 'anthropic':
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id);
    case 'openai':
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id);
    case 'gateway':
      return createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })(id);
  }
}
