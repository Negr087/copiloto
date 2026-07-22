"use client";

import { useEffect, useState } from "react";

interface Entry {
  id: string;
  ts: number;
  kind: string;
  preview: string;
  status: "ok" | "error" | "cancelled" | "pending";
  title: string;
  detail?: string;
}

interface Pending {
  id: string;
  titulo: string;
  detalle: string;
  expiraEn: number;
}

const COLOR: Record<Entry["status"], string> = {
  ok: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
  error: "text-red-400 border-red-400/30 bg-red-400/5",
  cancelled: "text-zinc-500 border-zinc-600/30 bg-zinc-500/5",
  pending: "text-amber-400 border-amber-400/30 bg-amber-400/5",
};

const TIPOS = ["invoice", "nostr", "lnurl", "onchain", "agente"] as const;
type Tipo = (typeof TIPOS)[number];

const ETIQUETA: Record<Tipo, string> = {
  invoice: "zap",
  nostr: "nostr",
  lnurl: "lnurl",
  onchain: "on-chain",
  agente: "agente",
};

const LIMITES = [10, 20, 50] as const;

type Conexion = "conectando" | "conectado" | "reconectando";

const CONEXION: Record<Conexion, { texto: string; dot: string }> = {
  conectando: { texto: "conectando...", dot: "bg-zinc-500" },
  conectado: { texto: "en vivo", dot: "bg-emerald-400" },
  reconectando: { texto: "reconectando...", dot: "bg-amber-400 animate-pulse" },
};

function claseFiltro(activo: boolean): string {
  return (
    "rounded-full border px-3 py-1 transition " +
    (activo
      ? "border-orange-500 text-orange-400 bg-orange-500/10"
      : "border-zinc-700 text-zinc-500 hover:border-zinc-500")
  );
}

export default function FeedPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [restante, setRestante] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [conexion, setConexion] = useState<Conexion>("conectando");
  const [filtro, setFiltro] = useState<Tipo | "todos">("todos");
  const [limite, setLimite] = useState<number>(20);

  useEffect(() => {
    const es = new EventSource("/api/feed/stream");

    es.onopen = () => setConexion("conectado");

    // Tras un error, el propio EventSource reintenta solo; readyState
    // CONNECTING (0) es esa espera, CLOSED (2) significa que se rindio.
    es.onerror = () => {
      setConexion(es.readyState === EventSource.CLOSED ? "conectando" : "reconectando");
    };

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { entries?: Entry[]; pending?: Pending | null };
        setEntries(data.entries ?? []);
        setPending(data.pending ?? null);
      } catch {
        // tick malformado, esperamos al siguiente
      }
    };

    return () => es.close();
  }, []);

  // Cuenta regresiva de la confirmacion.
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => {
      setRestante(Math.max(0, Math.round((pending.expiraEn - Date.now()) / 1000)));
    }, 200);
    return () => clearInterval(id);
  }, [pending]);

  const filtradas = filtro === "todos" ? entries : entries.filter((e) => e.kind === filtro);
  const visibles = filtradas.slice(0, limite);

  async function decidir(aprobado: boolean) {
    if (!pending || enviando) return;
    setEnviando(true);
    try {
      await fetch("/api/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pending.id, aprobado }),
      });
      setPending(null);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05070e] text-zinc-100 p-10 font-mono">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            Copiloto<span className="text-orange-500">.</span>
          </h1>
          <p className="text-zinc-500 mt-2">
            Tu portapapeles no habla Bitcoin. Copiloto si.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500 pt-2 shrink-0">
          <span className={"h-2 w-2 rounded-full " + CONEXION[conexion].dot} />
          {CONEXION[conexion].texto}
        </div>
      </header>

      {pending && (
        <div className="mb-8 border-2 border-amber-400 rounded-xl p-6 bg-amber-400/10 animate-pulse-none">
          <div className="text-xs uppercase tracking-widest text-amber-400 mb-2">
            Confirmacion requerida - {restante}s
          </div>
          <div className="text-2xl font-bold mb-1">{pending.titulo}</div>
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap mb-5 font-mono">
            {pending.detalle}
          </pre>
          <div className="flex gap-3">
            <button
              onClick={() => decidir(true)}
              disabled={enviando}
              className="px-6 py-3 rounded-lg bg-emerald-500 text-black font-bold hover:bg-emerald-400 disabled:opacity-50 transition"
            >
              Pagar
            </button>
            <button
              onClick={() => decidir(false)}
              disabled={enviando}
              className="px-6 py-3 rounded-lg bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 disabled:opacity-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !pending && (
        <div className="border border-dashed border-zinc-800 rounded-xl p-16 text-center text-zinc-600">
          Copia una factura Lightning o un npub para empezar
        </div>
      )}

      {entries.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest">
          <button onClick={() => setFiltro("todos")} className={claseFiltro(filtro === "todos")}>
            Todos
          </button>
          {TIPOS.map((t) => (
            <button key={t} onClick={() => setFiltro(t)} className={claseFiltro(filtro === t)}>
              {ETIQUETA[t]}
            </button>
          ))}

          <span className="ml-auto flex items-center gap-2 text-zinc-500 normal-case tracking-normal">
            {visibles.length} / {filtradas.length}
            <select
              value={limite}
              onChange={(ev) => setLimite(Number(ev.target.value))}
              className="rounded border border-zinc-700 bg-transparent px-2 py-1 text-zinc-300"
            >
              {LIMITES.map((n) => (
                <option key={n} value={n} className="bg-[#05070e]">
                  {n}
                </option>
              ))}
            </select>
          </span>
        </div>
      )}

      {entries.length > 0 && visibles.length === 0 && (
        <div className="border border-dashed border-zinc-800 rounded-xl p-16 text-center text-zinc-600">
          No hay entradas de este tipo todavia
        </div>
      )}

      <ul className="space-y-3">
        {visibles.map((e) => (
          <li
            key={e.id}
            className={"border rounded-xl p-5 flex gap-5 items-start " + COLOR[e.status]}
          >
            <span className="text-xs uppercase tracking-widest opacity-60 w-16 shrink-0 pt-1">
              {ETIQUETA[e.kind as Tipo] ?? e.kind}
            </span>

            <div className="flex-1 min-w-0">
              <div className="font-semibold text-zinc-100">{e.title}</div>
              {e.detail && (
                <div className="text-sm text-zinc-400 mt-1 whitespace-pre-wrap line-clamp-4">
                  {e.detail}
                </div>
              )}
              <div className="text-xs text-zinc-600 mt-2">{e.preview}</div>
            </div>

            <time className="text-xs text-zinc-600 shrink-0">
              {new Date(e.ts).toLocaleTimeString("es-AR")}
            </time>
          </li>
        ))}
      </ul>
    </main>
  );
}
