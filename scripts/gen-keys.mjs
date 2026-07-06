import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

// Generate a throwaway Nostr keypair for local development.
// NEVER use a real/personal nsec here — this is for testing publishes only.

const sk = generateSecretKey(); // Uint8Array
const pk = getPublicKey(sk); // hex string
const nsec = nip19.nsecEncode(sk);
const npub = nip19.npubEncode(pk);

console.log('\n🔑  Clave Nostr descartable (solo para desarrollo)\n');
console.log('NOSTR_NSEC=' + nsec);
console.log('\nnpub        ' + npub);
console.log('pubkey (hex)  ' + pk);
console.log('\n👉 Pegá la línea NOSTR_NSEC en tu archivo .env\n');
