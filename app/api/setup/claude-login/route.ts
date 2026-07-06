import { runSetupToken } from '@/lib/claudeToken';
import { clearEnvVar, saveEnvVar } from '@/lib/envFile';
import { authStatus, setupDisabledResponse, setupEnabled } from '@/lib/setupAuth';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * "Conectar con Claude" — runs the official `claude setup-token` on the server,
 * which opens the browser for OAuth approval, then saves the resulting token to
 * .env. Best-effort: if the CLI can't run non-interactively, the response tells
 * the user to use `pnpm setup` or paste a token instead.
 */
export async function POST() {
  if (!setupEnabled()) return setupDisabledResponse();
  try {
    const token = await runSetupToken();
    await saveEnvVar('CLAUDE_CODE_OAUTH_TOKEN', token);
    await clearEnvVar('ANTHROPIC_API_KEY');
    return Response.json({ ok: true, status: authStatus() });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message });
  }
}
