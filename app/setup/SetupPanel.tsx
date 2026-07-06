'use client';

import { useCallback, useEffect, useState } from 'react';

type ProviderStatus = {
  id: string;
  label: string;
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

type Status = {
  provider: string;
  providerLabel: string;
  model: string;
  configured: boolean;
  providers: ProviderStatus[];
};

type Msg = { kind: 'ok' | 'error' | 'info'; text: string } | null;

export function SetupPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState<null | 'save' | 'connect' | 'test'>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const refresh = useCallback(async (): Promise<Status | null> => {
    try {
      const s: Status = await (await fetch('/api/setup/status')).json();
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().then((s) => s && setSelected(s.provider));
  }, [refresh]);

  const current = status?.providers.find((p) => p.id === selected) ?? null;

  function pick(id: string) {
    setSelected(id);
    setApiKey('');
    setModel('');
    setMsg(null);
  }

  async function save() {
    if (!selected) return;
    setBusy('save');
    setMsg(null);
    try {
      const r = await fetch('/api/setup/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selected, model, apiKey }),
      });
      const data = await r.json();
      if (data.ok) {
        setStatus(data.status);
        setApiKey('');
        setMsg({ kind: 'ok', text: 'Configuración guardada. Probá la conexión.' });
      } else {
        setMsg({ kind: 'error', text: data.error ?? 'No se pudo guardar.' });
      }
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    setBusy('connect');
    setMsg({ kind: 'info', text: 'Abriendo el navegador para aprobar el acceso…' });
    try {
      const data = await (await fetch('/api/setup/claude-login', { method: 'POST' })).json();
      if (data.ok) {
        setStatus(data.status);
        setMsg({ kind: 'ok', text: '¡Conectado! Token guardado en .env.' });
      } else {
        setMsg({ kind: 'error', text: data.error ?? 'No se pudo conectar.' });
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
      const data = await (await fetch('/api/setup/test', { method: 'POST' })).json();
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

  if (!status) return <p className="text-sm text-muted">Cargando…</p>;

  return (
    <div className="space-y-6">
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
          Proveedor: {status.providerLabel}
        </span>
        <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-muted">
          Modelo: {status.model}
        </span>
      </div>

      {msg && <p className={`text-sm ${msgColor}`}>{msg.text}</p>}

      {/* Step 1: pick a provider */}
      <section>
        <h2 className="mb-2 text-sm font-mono uppercase tracking-widest text-muted">
          1 · Proveedor
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {status.providers.map((p) => {
            const active = p.id === selected;
            return (
              <button
                key={p.id}
                onClick={() => pick(p.id)}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  active ? 'border-cyan/60 bg-cyan/10' : 'border-border bg-surface hover:border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.label}</span>
                  {p.configured && <span className="text-xs text-green-400">●</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted">
                  {p.free && <span className="rounded bg-surface-2 px-1.5 py-0.5">gratis</span>}
                  {p.toolsInChat ? (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5">tools en chat</span>
                  ) : (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5">sin tools en chat</span>
                  )}
                  <span className="rounded bg-surface-2 px-1.5 py-0.5">
                    {p.runtime === 'node' ? 'solo Node' : 'edge/serverless'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: credential for the selected provider */}
      {current && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted">
            2 · Credencial · {current.label}
          </h2>
          {current.note && <p className="mt-1 text-sm text-muted">{current.note}</p>}

          {current.connect && (
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
          )}

          <label className="mt-4 block text-xs text-muted">
            {current.connect ? 'o pegá el token' : current.keyLabel}
          </label>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={current.keyPlaceholder}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-cyan/60"
          />
        </section>
      )}

      {/* Step 3: model */}
      {current && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted">3 · Modelo</h2>
          <p className="mt-1 text-sm text-muted">
            Dejalo vacío para usar el default (<code className="font-mono">{current.defaultModel}</code>).
          </p>
          <input
            list="model-suggestions"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={current.defaultModel}
            className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-cyan/60"
          />
          <datalist id="model-suggestions">
            {current.modelSuggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={save}
          disabled={busy !== null || !selected}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          {busy === 'save' ? 'Guardando…' : 'Guardar configuración'}
        </button>
        <button
          onClick={test}
          disabled={busy !== null}
          className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm disabled:opacity-40"
        >
          {busy === 'test' ? 'Probando…' : 'Probar conexión'}
        </button>
      </div>

      <a href="/" className="inline-block text-sm text-cyan hover:underline">
        ← Volver al chat
      </a>
    </div>
  );
}
