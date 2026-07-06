import { getModelId, getProvider, isAuthConfigured, modeLabel } from './model';
import { PROVIDER_IDS, PROVIDERS, type ProviderId } from './providers';

/**
 * The /setup flow writes credentials to .env and exposes a connect flow, so it
 * is DEV-ONLY. In production, config comes from the platform's env vars.
 */
export function setupEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function setupDisabledResponse(): Response {
  return Response.json(
    { error: 'El setup solo está disponible en desarrollo. En producción configurá las variables de entorno.' },
    { status: 403 },
  );
}

export type ProviderStatus = {
  id: ProviderId;
  label: string;
  keyEnv: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyPrefix: string | null;
  connect: boolean;
  free: boolean;
  runtime: 'node' | 'any';
  toolsInChat: boolean;
  defaultModel: string;
  modelSuggestions: string[];
  note: string | null;
  configured: boolean;
};

export type AuthStatus = {
  provider: ProviderId;
  providerLabel: string;
  model: string;
  configured: boolean;
  setupEnabled: boolean;
  providers: ProviderStatus[];
};

export function authStatus(): AuthStatus {
  const provider = getProvider();
  return {
    provider,
    providerLabel: modeLabel(provider),
    model: getModelId(provider),
    configured: isAuthConfigured(provider),
    setupEnabled: setupEnabled(),
    providers: PROVIDER_IDS.map((id) => {
      const m = PROVIDERS[id];
      return {
        id,
        label: m.label,
        keyEnv: m.keyEnv,
        keyLabel: m.keyLabel,
        keyPlaceholder: m.keyPlaceholder,
        keyPrefix: m.keyPrefix ?? null,
        connect: m.connect,
        free: m.free,
        runtime: m.runtime,
        toolsInChat: m.toolsInChat,
        defaultModel: m.defaultModel,
        modelSuggestions: m.modelSuggestions,
        note: m.note ?? null,
        configured: Boolean(process.env[m.keyEnv]?.trim()),
      };
    }),
  };
}
