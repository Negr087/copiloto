import { runSetupToken } from '../lib/claudeToken';
import { clearEnvVar, saveEnvVar } from '../lib/envFile';

// `pnpm setup` — connect your Claude Pro/Max subscription for local dev.
// Runs the official `claude setup-token` (opens the browser), captures the
// long-lived token, and saves it to .env as CLAUDE_CODE_OAUTH_TOKEN.

async function main() {
  console.log('\n🔐  Conectá tu suscripción de Claude (Pro/Max) para desarrollar gratis.');
  console.log('    Se abrirá el navegador para aprobar el acceso.\n');

  const token = await runSetupToken({
    interactive: true,
    onOutput: (s) => process.stderr.write(s),
  });

  await saveEnvVar('CLAUDE_CODE_OAUTH_TOKEN', token);
  await clearEnvVar('ANTHROPIC_API_KEY');

  console.log('\n✅  Token guardado en .env (CLAUDE_CODE_OAUTH_TOKEN).');
  console.log('    Corré `pnpm dev` — el chat funciona en modo suscripción.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('\n❌  ' + (err instanceof Error ? err.message : String(err)));
    console.error('\nAlternativas:');
    console.error('  • Ejecutá `claude setup-token` a mano y pegá el token en la página /setup.');
    console.error('  • O usá una API key de Anthropic en /setup (o en .env como ANTHROPIC_API_KEY).\n');
    process.exit(1);
  });
