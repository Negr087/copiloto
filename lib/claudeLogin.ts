import { createRequire } from 'node:module';
import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Web-driven wrapper around the OFFICIAL `claude setup-token`, for the "Conectar
 * con Claude" button in /setup.
 *
 * How `claude setup-token` actually works (verified):
 *   1. It binds a LOOPBACK HTTP server on 127.0.0.1:<random port>.
 *   2. It opens the browser at the Claude OAuth page with
 *      `redirect_uri=http://localhost:<port>/callback`.
 *   3. After the user approves, the browser redirects to that local URL; the
 *      CLI's own server AUTO-CAPTURES the code, exchanges it (it holds the PKCE
 *      verifier + state), and prints the long-lived `sk-ant-oat01-…` token.
 *   4. As a fallback for headless/remote machines it ALSO prints a
 *      `platform.claude.com/oauth/code/callback` URL and a "Paste code here"
 *      prompt — a manual path where the user copies the code and pastes it.
 *
 * So the primary flow needs NO manual paste: we spawn the CLI under a PTY (so the
 * Ink TUI renders and its loopback server runs), keep it alive, and POLL its
 * output until the token appears. The manual paste path is kept as a fallback.
 *
 * This is ToS-compliant: we only run the official CLI and read its output — we do
 * NOT re-implement OAuth. `pnpm setup` (scripts/setup-auth.ts) is the terminal
 * equivalent and is left untouched.
 */

const OAUTH_FALLBACK_URL_RE = /https:\/\/claude\.com\/\S*oauth\S*/i;
const TOKEN_RE = /sk-ant-oat01-[A-Za-z0-9_-]+/;
const INVALID_CODE_RE = /oauth error|invalid code|make sure the full code/i;

const ESC = String.fromCharCode(27);
// Collapse ANSI CSI sequences, the two-char ESC codes the TUI emits, and CRs so
// wrapped/redrawn text is easy to scan.
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]|${ESC}[>=<]|\\r`, 'g');
const strip = (s: string) => s.replace(ANSI_RE, '\n');

// Minimal structural type so this file doesn't hard-depend on node-pty's types
// (it's an optionalDependency — a missing install must not break the build).
type PtyProcess = {
  write(data: string): void;
  kill(signal?: string): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): void;
};

type Session = {
  pty: PtyProcess;
  buffer: string;
  done: boolean;
  timer: NodeJS.Timeout | null;
};

// Persist the active session across dev HMR module reloads.
const g = globalThis as unknown as { __claudeLoginSession?: Session | null };
const getSession = () => g.__claudeLoginSession ?? null;
const setSession = (s: Session | null) => {
  g.__claudeLoginSession = s;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const findToken = (s: Session) => strip(s.buffer).match(TOKEN_RE)?.[0] ?? null;
const findFallbackUrl = (s: Session) => strip(s.buffer).match(OAUTH_FALLBACK_URL_RE)?.[0] ?? null;

/**
 * node-pty ships prebuilt binaries but the unix `spawn-helper` sometimes lands
 * without the executable bit (breaks `posix_spawnp`). Fix it best-effort before
 * spawning so a fresh `pnpm install` works out of the box.
 */
function ensureSpawnHelperExecutable(): void {
  try {
    const require = createRequire(import.meta.url);
    const root = path.dirname(require.resolve('node-pty/package.json'));
    const candidates = [
      path.join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
      path.join(root, 'build', 'Release', 'spawn-helper'),
    ];
    for (const p of candidates) if (existsSync(p)) chmodSync(p, 0o755);
  } catch {
    // best-effort; spawn will surface a clear error if the helper is unusable
  }
}

async function loadPtySpawn(): Promise<(typeof import('node-pty'))['spawn']> {
  let mod: typeof import('node-pty');
  try {
    mod = await import('node-pty');
  } catch {
    throw new Error(
      'El botón "Conectar" necesita el paquete node-pty y no se pudo cargar. Usá `pnpm setup` en la terminal, o pegá el token abajo.',
    );
  }
  const spawn = mod.spawn ?? (mod as { default?: typeof mod }).default?.spawn;
  if (typeof spawn !== 'function') {
    throw new Error('node-pty no expone spawn(). Reinstalá dependencias o usá `pnpm setup`.');
  }
  return spawn;
}

/** Kill and clear any active login session. */
export function cancelClaudeLogin(): void {
  const s = getSession();
  if (s) {
    if (s.timer) clearTimeout(s.timer);
    if (!s.done) {
      try {
        s.pty.kill();
      } catch {
        // ignore
      }
    }
  }
  setSession(null);
}

/**
 * Step 1 — spawn `claude setup-token`. It opens the browser and starts its
 * loopback callback server. Returns the manual-paste fallback URL if it has been
 * printed yet (it may arrive a bit later — pollClaudeLogin also returns it). The
 * process is kept ALIVE so its loopback server can auto-capture the code.
 */
export async function startClaudeLogin(): Promise<{ fallbackUrl: string | null }> {
  cancelClaudeLogin();
  ensureSpawnHelperExecutable();
  const spawn = await loadPtySpawn();

  let child: PtyProcess;
  try {
    child = spawn('claude', ['setup-token'], {
      name: 'xterm-256color',
      cols: 800, // wide enough that URLs never wrap
      rows: 40,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    }) as unknown as PtyProcess;
  } catch (e) {
    throw new Error(
      `No se pudo ejecutar "claude setup-token": ${(e as Error).message}. ¿Está instalado el CLI de Claude Code? Probá \`pnpm setup\`.`,
    );
  }

  const session: Session = { pty: child, buffer: '', done: false, timer: null };
  setSession(session);
  child.onData((d) => {
    session.buffer += d;
  });
  child.onExit(() => {
    session.done = true;
  });
  // Safety valve: never leave an orphaned CLI (and its loopback port) forever.
  session.timer = setTimeout(() => cancelClaudeLogin(), 10 * 60_000);

  // Give the TUI a moment to boot; return the fallback URL if it's already out.
  for (let i = 0; i < 16; i++) {
    if (session.done) {
      cancelClaudeLogin();
      throw new Error(
        'El CLI de Claude terminó antes de iniciar el login. Verificá que `claude` funcione y probá `pnpm setup`.',
      );
    }
    const url = findFallbackUrl(session);
    if (url) return { fallbackUrl: url };
    await wait(400);
  }
  return { fallbackUrl: null };
}

export type PollResult =
  | { status: 'pending'; fallbackUrl: string | null }
  | { status: 'done'; token: string }
  | { status: 'error'; error: string };

/**
 * Step 2 (primary) — check whether the loopback server has auto-captured the code
 * and the token has been printed. The frontend calls this on an interval while
 * the user approves in the browser.
 */
export function pollClaudeLogin(): PollResult {
  const s = getSession();
  if (!s) {
    return { status: 'error', error: 'No hay una conexión en curso. Volvé a tocar "Conectar con Claude".' };
  }
  const token = findToken(s);
  if (token) return { status: 'done', token };
  if (s.done) {
    return {
      status: 'error',
      error: 'El CLI se cerró sin devolver un token. Reintentá "Conectar con Claude" o usá `pnpm setup`.',
    };
  }
  return { status: 'pending', fallbackUrl: findFallbackUrl(s) };
}

type Outcome =
  | { type: 'token'; token: string }
  | { type: 'invalid' }
  | { type: 'exited' }
  | { type: 'timeout' };

async function pollOutcome(session: Session, fromIndex: number, timeoutMs: number): Promise<Outcome> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const fresh = strip(session.buffer.slice(fromIndex));
    const token = fresh.match(TOKEN_RE);
    if (token) return { type: 'token', token: token[0] };
    if (INVALID_CODE_RE.test(fresh)) return { type: 'invalid' };
    if (session.done) {
      const last = findToken(session);
      return last ? { type: 'token', token: last } : { type: 'exited' };
    }
    if (Date.now() > deadline) return { type: 'timeout' };
    await wait(300);
  }
}

/**
 * Step 2 (fallback) — for the manual path: inject the authorization code the user
 * copied from the `platform.claude.com` fallback page. Returns the token, or
 * keeps the session alive on a bad code so the user can retry.
 */
export async function submitClaudeCode(rawCode: string): Promise<string> {
  const session = getSession();
  if (!session || session.done) {
    throw new Error('No hay una conexión en curso. Volvé a tocar "Conectar con Claude".');
  }
  const code = rawCode.trim();
  if (!code) throw new Error('Pegá el código de autorización que te dio el navegador.');
  if (/[\r\n]/.test(code)) throw new Error('El código no debe tener saltos de línea.');

  // If the loopback server already auto-captured it, no need to inject anything.
  const already = findToken(session);
  if (already) {
    cancelClaudeLogin();
    return already;
  }

  const from = session.buffer.length;
  try {
    session.pty.write(code + '\r');
  } catch (e) {
    cancelClaudeLogin();
    throw new Error(`No se pudo enviar el código al CLI: ${(e as Error).message}. Probá \`pnpm setup\`.`);
  }

  const outcome = await pollOutcome(session, from, 60_000);

  if (outcome.type === 'token') {
    cancelClaudeLogin();
    return outcome.token;
  }
  if (outcome.type === 'invalid') {
    // Return the CLI to the paste prompt so the same session can be retried.
    try {
      session.pty.write('\r');
    } catch {
      // ignore
    }
    throw new Error(
      'El código es inválido o incompleto. Copiá el código COMPLETO del navegador y pegalo de nuevo.',
    );
  }
  cancelClaudeLogin();
  if (outcome.type === 'timeout') {
    throw new Error('Se agotó el tiempo esperando la respuesta del CLI. Reintentá "Conectar con Claude".');
  }
  throw new Error('El CLI se cerró sin devolver un token. Reintentá "Conectar con Claude" o usá `pnpm setup`.');
}

/** Whether a login is mid-flight (for status/debug). */
export function claudeLoginActive(): boolean {
  const s = getSession();
  return Boolean(s && !s.done);
}
