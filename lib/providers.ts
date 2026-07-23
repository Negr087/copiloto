/**
 * AI provider registry. One place to add/remove providers; the model layer
 * (lib/model.ts) and the /setup UI both read from here.
 *
 *  - subscription: Claude Code CLI (free, your Pro/Max plan). Node runtime only;
 *    does NOT bridge chat tools.
 *  - anthropic:    Anthropic API key.
 *  - openai:       OpenAI API key.
 *  - gateway:      Vercel AI Gateway — one key, any model via "creator/model"
 *    slugs (anthropic/…, openai/…, google/…, etc.).
 */

export const PROVIDER_IDS = ['subscription', 'anthropic', 'openai', 'gateway'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ProviderMeta = {
  id: ProviderId;
  label: string;
  /** Env var that holds this provider's credential. */
  keyEnv: string;
  /** UI hints for the credential input. */
  keyLabel: string;
  keyPlaceholder: string;
  /** Optional validation prefix for a pasted credential. */
  keyPrefix?: string;
  /** Whether this provider has the "Conectar con Claude" (setup-token) flow. */
  connect: boolean;
  free: boolean;
  /** Deploy runtime: 'node' (spawns a subprocess) or 'any'. */
  runtime: 'node' | 'any';
  defaultModel: string;
  modelSuggestions: string[];
  note?: string;
};

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  subscription: {
    id: 'subscription',
    label: 'Claude (suscripción)',
    keyEnv: 'CLAUDE_CODE_OAUTH_TOKEN',
    keyLabel: 'Token de Claude Code',
    keyPlaceholder: 'sk-ant-oat01-…',
    keyPrefix: 'sk-ant-oat01-',
    connect: true,
    free: true,
    runtime: 'node',
    defaultModel: 'claude-opus-4-8',
    modelSuggestions: ['opus', 'sonnet', 'haiku', 'claude-opus-4-8'],
    note: 'Gratis con tu plan Pro/Max. Solo Node.js (no edge).',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (API key)',
    keyEnv: 'ANTHROPIC_API_KEY',
    keyLabel: 'Anthropic API key',
    keyPlaceholder: 'sk-ant-api…',
    keyPrefix: 'sk-ant-api',
    connect: false,
    free: false,
    runtime: 'any',
    defaultModel: 'claude-opus-4-8',
    modelSuggestions: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (API key)',
    keyEnv: 'OPENAI_API_KEY',
    keyLabel: 'OpenAI API key',
    keyPlaceholder: 'sk-…',
    keyPrefix: 'sk-',
    connect: false,
    free: false,
    runtime: 'any',
    defaultModel: 'gpt-4o',
    modelSuggestions: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4.1'],
  },
  gateway: {
    id: 'gateway',
    label: 'Vercel AI Gateway',
    keyEnv: 'AI_GATEWAY_API_KEY',
    keyLabel: 'Vercel AI Gateway key',
    keyPlaceholder: 'vck_…',
    connect: false,
    free: false,
    runtime: 'any',
    defaultModel: 'anthropic/claude-opus-4-8',
    modelSuggestions: [
      'anthropic/claude-opus-4-8',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
      'meta/llama-3.3-70b',
    ],
    note: 'Una sola key para cualquier modelo. El modelo se escribe como "proveedor/modelo".',
  },
};

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === 'string' && (PROVIDER_IDS as readonly string[]).includes(v);
}
