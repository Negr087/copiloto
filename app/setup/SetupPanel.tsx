'use client';

import { useCallback, useEffect, useState } from 'react';

type Status = {
  mode: 'subscription' | 'apikey';
  modeLabel: string;
  modelId: string;
  configured: boolean;
  hasOAuthToken: boolean;
  hasApiKey: boolean;
};

type Msg = { kind: 'ok' | 'error' | 'info'; text: string } | null;

export function SetupPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState<null | 'connect' | 'save' | 'test'>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/setup/status');
      setStatus(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function connect() {
    setBusy('connect');
    setMsg({ kind: 'info', text: 'Abriendo el navegador para aprobar el acceso…' });
    try {
      const r = await fetch('/api/setup/claude-login', { method: 'POST' });
      const data = await r.json();
      if (data.ok) {
        setMsg({ kind: 'ok', text: '¡Conectado! Token guardado en .env.' });
        setStatus(data.status);
      } else {
        setMsg({ kind: 'error', text: data.error ?? 'No se pudo conectar.' });
      }
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!value.trim()) return;
    setBusy('save');
    setMsg(null);
    try {
      const r = await fetch('/api/setup/credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const data = await r.json();
      if (data.ok) {
        setMsg({ kind: 'ok', text: `Guardado (${data.kind}). Probá la conexión.` });
        setStatus(data.status);
        setValue('');
      } else {
        setMsg({ kind: 'error', text: data.error ?? 'No se pudo guardar.' });
      }
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy('test');
    setMsg({ kind: 'info', text: 'Probando una llamada al modelo…' });
    try {
      const r = await fetch('/api/setup/test', { method: 'POST' });
      const data = await r.json();
      setMsg(
        data.ok
          ? { kind: 'ok', text: `✅ Funciona. El modelo respondió: "${data.sample}"` }
          : { kind: 'error', text: `❌ ${data.error}` },
      );
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const msgColor =
    msg?.kind === 'ok' ? 'text-green-400' : msg?.kind === 'error' ? 'text-red-400' : 'text-muted';

  return (
    <div className="space-y-6">
      {status && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-md border px-2 py-1 ${
              status.configured
                ? 'border-green-500/40 bg-green-500/10 text-green-400'
                : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
            }`}
          >
            {status.configured ? '● configurado' : '○ sin configurar'}
          </span>
          <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-muted">
            Modo: {status.modeLabel}
          </span>
          <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-muted">
            Modelo: {status.modelId}
          </span>
        </div>
      )}

      {msg && <p className={`text-sm ${msgColor}`}>{msg.text}</p>}

      {/* Option 1: connect subscription */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">1 · Conectar tu suscripción de Claude (Pro/Max)</h2>
        <p className="mt-1 text-sm text-muted">
          Usa el comando oficial <code className="font-mono text-cyan">claude setup-token</code>. Se abre
          el navegador, aprobás, y guardamos un token de larga duración en <code className="font-mono">.env</code>.
          Gratis con tu suscripción.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={connect}
            disabled={busy !== null}
            className="rounded-lg bg-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            {busy === 'connect' ? 'Conectando…' : 'Conectar con Claude'}
          </button>
          <span className="text-xs text-muted">
            o desde la terminal: <code className="font-mono text-foreground">pnpm setup</code>
          </span>
        </div>
      </section>

      {/* Option 2: paste a credential */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">2 · Pegar una credencial</h2>
        <p className="mt-1 text-sm text-muted">
          Un token de <code className="font-mono text-cyan">claude setup-token</code>{' '}
          (<code className="font-mono">sk-ant-oat01-…</code>) para modo suscripción, o una{' '}
          <code className="font-mono text-nostr">API key</code> de Anthropic{' '}
          (<code className="font-mono">sk-ant-api…</code>) para modo API key. Se detecta sola.
        </p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-oat01-…  o  sk-ant-api…"
          rows={3}
          className="mt-3 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-cyan/60"
        />
        <button
          onClick={save}
          disabled={busy !== null || value.trim() === ''}
          className="mt-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          {busy === 'save' ? 'Guardando…' : 'Guardar en .env'}
        </button>
      </section>

      {/* Option 3: test */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">3 · Probar la conexión</h2>
        <p className="mt-1 text-sm text-muted">Hace una llamada mínima al modelo con las credenciales actuales.</p>
        <button
          onClick={test}
          disabled={busy !== null}
          className="mt-3 rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm disabled:opacity-40"
        >
          {busy === 'test' ? 'Probando…' : 'Probar conexión'}
        </button>
      </section>

      <a href="/" className="inline-block text-sm text-cyan hover:underline">
        ← Volver al chat
      </a>
    </div>
  );
}
