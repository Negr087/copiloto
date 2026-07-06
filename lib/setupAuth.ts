import { getModelId, isAuthConfigured, modeLabel, useSubscription } from './model';

/**
 * The /setup flow writes credentials to .env and exposes an OAuth flow, so it is
 * DEV-ONLY. In production, credentials come from the platform's env vars.
 */
export function setupEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** JSON 403 used by every setup route when running in production. */
export function setupDisabledResponse(): Response {
  return Response.json(
    { error: 'El setup solo está disponible en desarrollo. En producción configurá las variables de entorno.' },
    { status: 403 },
  );
}

export type AuthStatus = {
  mode: 'subscription' | 'apikey';
  modeLabel: string;
  modelId: string;
  configured: boolean;
  hasOAuthToken: boolean;
  hasApiKey: boolean;
  setupEnabled: boolean;
};

export type CredentialKind = 'oauth-token' | 'api-key' | 'refresh' | 'unknown';

/**
 * Classify a pasted credential by prefix:
 *  - sk-ant-oat01-  → Claude Code OAuth token → CLAUDE_CODE_OAUTH_TOKEN
 *  - sk-ant-api...  → Anthropic API key       → ANTHROPIC_API_KEY
 *  - sk-ant-ort01-  → refresh token (not usable on its own)
 */
export function detectCredential(value: string): CredentialKind {
  const v = value.trim();
  if (v.startsWith('sk-ant-oat01-')) return 'oauth-token';
  if (v.startsWith('sk-ant-ort01-')) return 'refresh';
  if (v.startsWith('sk-ant-api')) return 'api-key';
  return 'unknown';
}

export function authStatus(): AuthStatus {
  return {
    mode: useSubscription() ? 'subscription' : 'apikey',
    modeLabel: modeLabel(),
    modelId: getModelId(),
    configured: isAuthConfigured(),
    hasOAuthToken: Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()),
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    setupEnabled: setupEnabled(),
  };
}
