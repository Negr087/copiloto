import { Chat } from "./components/Chat";

const STACK = [
  { label: "Next.js 16", color: "text-foreground" },
  { label: "Mastra", color: "text-cyan" },
  { label: "Vercel AI SDK", color: "text-foreground" },
  { label: "Lightning · NWC", color: "text-lightning" },
  { label: "Nostr", color: "text-nostr" },
];

export default function Home() {
  const useSubscription = !process.env.ANTHROPIC_API_KEY;
  const modelId = process.env.MODEL_ID?.trim() || "claude-opus-4-8";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <p className="mb-3 text-xs font-mono uppercase tracking-widest text-bitcoin">
        La Crypta · Hackathon AI AGENTS
      </p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        AI Agents Starter
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
        Boilerplate para el track <strong className="text-foreground">Bots &amp; Automation</strong>:
        agentes autónomos y workflows que combinan LLMs con Bitcoin/Lightning (NWC) y Nostr.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm font-mono">
        {STACK.map((s) => (
          <span
            key={s.label}
            className={`rounded-full border border-border bg-surface px-3 py-1 ${s.color}`}
          >
            {s.label}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-md border border-border bg-surface-2 px-2 py-1">
          Modo: {useSubscription ? "suscripción (Claude Code)" : "API key"}
        </span>
        <span className="rounded-md border border-border bg-surface-2 px-2 py-1">
          Modelo: {modelId}
        </span>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-mono uppercase tracking-widest text-muted">
          Chat con el agente
        </h2>
        <Chat />
      </section>

      <section className="mt-10 rounded-xl border border-border bg-surface p-5 text-sm text-muted">
        <h2 className="mb-2 font-medium text-foreground">Próximos pasos</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Corré la playground de Mastra:{" "}
            <code className="font-mono text-cyan">pnpm playground</code> (Studio en
            <code className="font-mono"> localhost:4111</code>) y probá el workflow{" "}
            <code className="font-mono text-lightning">pay-and-post</code>.
          </li>
          <li>
            Generá una clave Nostr descartable:{" "}
            <code className="font-mono text-nostr">pnpm gen:keys</code>.
          </li>
          <li>
            Editá el agente en <code className="font-mono">src/mastra/agents/</code> y las
            herramientas en <code className="font-mono">src/mastra/tools/</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}
