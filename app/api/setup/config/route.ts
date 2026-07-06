import { saveEnvVar, clearEnvVar } from '@/lib/envFile';
import { PROVIDERS, isProviderId } from '@/lib/providers';
import { authStatus, setupDisabledResponse, setupEnabled } from '@/lib/setupAuth';

export const runtime = 'nodejs';

/**
 * Set the AI provider, model, and (optionally) the provider's API key — all in
 * one call. Writes AI_PROVIDER, MODEL_ID, and the provider's key env var to .env
 * (dev-only). Change it any time by calling this again.
 *
 * Body: { provider: ProviderId, model?: string, apiKey?: string }
 *  - model: set MODEL_ID; empty string clears it (use the provider default).
 *  - apiKey: validated against the provider's prefix and saved to its key env.
 */
export async function POST(req: Request) {
  if (!setupEnabled()) return setupDisabledResponse();

  let body: { provider?: string; model?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (!isProviderId(body.provider)) {
    return Response.json({ error: 'Proveedor inválido.' }, { status: 400 });
  }
  const meta = PROVIDERS[body.provider];

  try {
    // Save the key first so a bad prefix fails before we switch providers.
    const apiKey = body.apiKey?.trim();
    if (apiKey) {
      if (meta.keyPrefix && !apiKey.startsWith(meta.keyPrefix)) {
        return Response.json(
          { error: `La credencial de ${meta.label} debería empezar con "${meta.keyPrefix}".` },
          { status: 400 },
        );
      }
      await saveEnvVar(meta.keyEnv, apiKey);
    }

    await saveEnvVar('AI_PROVIDER', body.provider);

    if (typeof body.model === 'string') {
      const model = body.model.trim();
      if (model) await saveEnvVar('MODEL_ID', model);
      else await clearEnvVar('MODEL_ID'); // fall back to the provider default
    }
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  return Response.json({ ok: true, status: authStatus() });
}
