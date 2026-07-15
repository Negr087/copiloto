import {
  cancelClaudeLogin,
  pollClaudeLogin,
  startClaudeLogin,
  submitClaudeCode,
} from '@/lib/claudeLogin';
import { saveEnvVar } from '@/lib/envFile';
import { authStatus, setupDisabledResponse, setupEnabled } from '@/lib/setupAuth';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function saveToken(token: string) {
  await saveEnvVar('CLAUDE_CODE_OAUTH_TOKEN', token);
  await saveEnvVar('AI_PROVIDER', 'subscription');
}

/**
 * "Conectar con Claude" — drives the official `claude setup-token`:
 *
 *   { action: 'start' }         → spawns the CLI. It opens the browser and runs
 *                                 its loopback callback server. Returns the
 *                                 manual-paste fallback URL if already printed.
 *   { action: 'poll' }          → primary path: check if the loopback server has
 *                                 auto-captured the code and printed the token;
 *                                 saves it to .env when it appears. Called on an
 *                                 interval by the UI while the user approves.
 *   { action: 'submit', code }  → fallback path: inject a code the user pasted
 *                                 from the fallback page, save the token.
 *   { action: 'cancel' }        → aborts an in-flight login (frees the port).
 *
 * Best-effort: if the CLI can't run, errors tell the user to use `pnpm setup` or
 * paste a token instead.
 */
export async function POST(req: Request) {
  if (!setupEnabled()) return setupDisabledResponse();

  let body: { action?: string; code?: string } = {};
  try {
    body = await req.json();
  } catch {
    // default to 'start' on empty/invalid body
  }

  try {
    if (body.action === 'cancel') {
      cancelClaudeLogin();
      return Response.json({ ok: true });
    }

    if (body.action === 'poll') {
      const r = pollClaudeLogin();
      if (r.status === 'done') {
        await saveToken(r.token);
        cancelClaudeLogin();
        return Response.json({ ok: true, stage: 'done', status: authStatus() });
      }
      if (r.status === 'error') {
        return Response.json({ ok: false, error: r.error });
      }
      return Response.json({ ok: true, stage: 'authorizing', fallbackUrl: r.fallbackUrl });
    }

    if (body.action === 'submit') {
      const token = await submitClaudeCode(String(body.code ?? ''));
      await saveToken(token);
      return Response.json({ ok: true, stage: 'done', status: authStatus() });
    }

    // action === 'start' (default)
    const { fallbackUrl } = await startClaudeLogin();
    return Response.json({ ok: true, stage: 'authorizing', fallbackUrl });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message });
  }
}
