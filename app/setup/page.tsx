import { setupEnabled } from '@/lib/setupAuth';
import { SetupPanel } from './SetupPanel';

export const metadata = { title: 'Configurar acceso — AI Agents Starter' };

export default function SetupPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <p className="mb-3 text-xs font-mono uppercase tracking-widest text-bitcoin">
        La Crypta · AI Agents Starter
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Configurar el proveedor de IA</h1>
      <p className="mt-3 text-muted">
        Elegí un proveedor (Claude gratis con tu suscripción, Anthropic, OpenAI o Vercel AI Gateway),
        el modelo, y guardá la credencial. Podés cambiarlo cuando quieras.
      </p>

      {setupEnabled() ? (
        <div className="mt-8">
          <SetupPanel />
        </div>
      ) : (
        <p className="mt-8 rounded-xl border border-border bg-surface p-5 text-sm text-muted">
          El asistente de setup solo está disponible en desarrollo. En producción, configurá{' '}
          <code className="font-mono">CLAUDE_CODE_OAUTH_TOKEN</code> o{' '}
          <code className="font-mono">ANTHROPIC_API_KEY</code> en las variables de entorno del deploy.
        </p>
      )}
    </main>
  );
}
