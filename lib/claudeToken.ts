import { spawn } from 'node:child_process';

/**
 * Wraps the OFFICIAL `claude setup-token` command. That command runs the Claude
 * OAuth flow in the browser and prints a long-lived (~1 year), inference-scoped
 * token that the Claude Code CLI reads from CLAUDE_CODE_OAUTH_TOKEN. This is the
 * sanctioned headless-auth path (same token the GitHub Action uses) — we do NOT
 * reverse-engineer the OAuth endpoints.
 *
 * Requires the Claude Code CLI installed and a Pro/Max/Team/Enterprise plan.
 */

const OAUTH_TOKEN_RE = /sk-ant-oat01-[A-Za-z0-9_-]+/;

export function runSetupToken(
  opts: { onOutput?: (chunk: string) => void; interactive?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  const { onOutput, interactive = false, timeoutMs = 240_000 } = opts;

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn('claude', ['setup-token'], {
        stdio: [interactive ? 'inherit' : 'ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      reject(
        new Error(
          `No se pudo ejecutar "claude setup-token": ${(e as Error).message}. ¿Está instalado el CLI de Claude Code?`,
        ),
      );
      return;
    }

    let out = '';
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => {
        child.kill('SIGTERM');
        reject(new Error('Se agotó el tiempo esperando la aprobación en el navegador.'));
      });
    }, timeoutMs);

    const onData = (buf: Buffer) => {
      const s = buf.toString();
      out += s;
      onOutput?.(s);
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);

    child.on('error', (e) =>
      finish(() =>
        reject(
          new Error(
            `No se pudo ejecutar "claude setup-token": ${e.message}. ¿Está instalado el CLI de Claude Code?`,
          ),
        ),
      ),
    );

    child.on('close', (code) => {
      finish(() => {
        const match = out.match(OAUTH_TOKEN_RE);
        if (match) resolve(match[0]);
        else
          reject(
            new Error(
              `No se encontró un token en la salida (exit ${code}). Ejecutá "claude setup-token" a mano y pegá el token en /setup.`,
            ),
          );
      });
    });
  });
}
