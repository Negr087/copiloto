import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { publishNote, getRelays } from '../lib/nostr';

// End-to-end smoke test of the Nostr path (no wallet needed):
// generates a throwaway key, signs a note, and publishes it to the relays.
// Run with:  pnpm demo

async function main() {
  const sk = generateSecretKey();
  const npub = nip19.npubEncode(getPublicKey(sk));

  const content =
    '⚡🤖 Test note from La Crypta AI Agents Starter — https://github.com/agustinkassis/ai-start';

  console.log('Publicando nota de prueba…');
  console.log('  npub  :', npub);
  console.log('  relays:', getRelays().join(', '));

  const { event, accepted, relays } = await publishNote(sk, content);

  console.log('\n✅ Nota publicada');
  console.log('  event id    :', event.id);
  console.log('  aceptada por:', accepted, 'de', relays.length, 'relays');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Falló la demo:', err);
    process.exit(1);
  });
