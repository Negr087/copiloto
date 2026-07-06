import { clearEnvVar, saveEnvVar } from '@/lib/envFile';
import {
  authStatus,
  detectCredential,
  setupDisabledResponse,
  setupEnabled,
} from '@/lib/setupAuth';

export const runtime = 'nodejs';

/**
 * Save a pasted credential to .env (dev-only). The kind is auto-detected from
 * the prefix (overridable with `kind` in the body):
 *  - sk-ant-oat01-  → CLAUDE_CODE_OAUTH_TOKEN (subscription). Clears ANTHROPIC_API_KEY.
 *  - sk-ant-api...  → ANTHROPIC_API_KEY (API-key mode).
 *  - sk-ant-ort01-  → rejected (that's a refresh token, not usable directly).
 */
export async function POST(req: Request) {
  if (!setupEnabled()) return setupDisabledResponse();

  let body: { value?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const value = body.value?.trim();
  if (!value) return Response.json({ error: 'Falta el valor a guardar.' }, { status: 400 });

  const kind = body.kind ?? detectCredential(value);

  try {
    if (kind === 'oauth-token') {
      await saveEnvVar('CLAUDE_CODE_OAUTH_TOKEN', value);
      // ANTHROPIC_API_KEY outranks the token — remove it so subscription mode wins.
      await clearEnvVar('ANTHROPIC_API_KEY');
    } else if (kind === 'api-key') {
      await saveEnvVar('ANTHROPIC_API_KEY', value);
      // Mutual exclusion: don't leave a now-dead-weight OAuth token behind.
      await clearEnvVar('CLAUDE_CODE_OAUTH_TOKEN');
    } else if (kind === 'refresh') {
      return Response.json(
        { error: 'Eso es un refresh token (sk-ant-ort01-). Pegá el access token (sk-ant-oat01-) o una API key (sk-ant-api...).' },
        { status: 400 },
      );
    } else {
      return Response.json(
        { error: 'No reconozco esa credencial. Pegá un token de Claude (sk-ant-oat01-) o una API key (sk-ant-api...).' },
        { status: 400 },
      );
    }
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  return Response.json({ ok: true, kind, status: authStatus() });
}
