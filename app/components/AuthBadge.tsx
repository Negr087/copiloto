'use client';

import { useEffect, useState } from 'react';

type Status = {
  mode: 'subscription' | 'apikey';
  modeLabel: string;
  modelId: string;
  configured: boolean;
};

export function AuthBadge() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  if (!status) return null;

  if (!status.configured) {
    return (
      <a
        href="/setup"
        className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300 hover:bg-yellow-500/15"
      >
        <span>⚠️ Falta configurar el acceso a Claude.</span>
        <span className="font-medium underline">Configurar →</span>
      </a>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span className="rounded-md border border-green-500/40 bg-green-500/10 px-2 py-1 text-green-400">
        ● conectado
      </span>
      <span className="rounded-md border border-border bg-surface-2 px-2 py-1">Modo: {status.modeLabel}</span>
      <span className="rounded-md border border-border bg-surface-2 px-2 py-1">Modelo: {status.modelId}</span>
      <a href="/setup" className="text-cyan hover:underline">
        cambiar
      </a>
    </div>
  );
}
