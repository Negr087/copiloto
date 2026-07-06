import {
  finalizeEvent,
  getPublicKey,
  verifyEvent,
  type Event,
} from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import type { Filter } from 'nostr-tools/filter';
import * as nip19 from 'nostr-tools/nip19';

/**
 * Nostr helpers (server-side).
 *
 * Import notes (nostr-tools v2 uses subpath exports — do NOT import from the
 * barrel 'nostr-tools'):
 *   - nostr-tools/pure  → finalizeEvent, getPublicKey, generateSecretKey
 *   - nostr-tools/pool  → SimplePool
 *   - nostr-tools/nip19 → bech32 encode/decode (nsec/npub)
 *
 * A secret key is a Uint8Array end-to-end. getPublicKey() returns hex.
 */

const FALLBACK_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol'];

/** Relays from NOSTR_RELAYS (comma-separated), else a sensible default. */
export function getRelays(): string[] {
  const fromEnv = process.env.NOSTR_RELAYS?.split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_RELAYS;
}

/** Decode an nsec (bech32) → 32-byte secret key. Throws if it isn't an nsec. */
export function decodeNsec(nsec: string): Uint8Array {
  const decoded = nip19.decode(nsec.trim());
  if (decoded.type !== 'nsec') {
    throw new Error(`Se esperaba un nsec, se recibió "${decoded.type}".`);
  }
  return decoded.data; // Uint8Array (narrowed by the type check)
}

/** Read the signing key from NOSTR_NSEC, or throw a clear Spanish error. */
export function getSecretKeyFromEnv(): Uint8Array {
  const nsec = process.env.NOSTR_NSEC?.trim();
  if (!nsec) {
    throw new Error(
      'NOSTR_NSEC no está configurada. Generá una clave descartable con `pnpm gen:keys` y pegala en .env.local.',
    );
  }
  return decodeNsec(nsec);
}

/**
 * Sign a kind-1 note and publish it to the relays.
 * Uses allSettled so one unreachable relay can't reject the whole publish.
 * Every event carries a ["client", "La Crypta AI Start"] tag by convention.
 */
export async function publishNote(
  sk: Uint8Array,
  content: string,
  relays: string[] = getRelays(),
): Promise<{ event: Event; accepted: number; relays: string[] }> {
  const event: Event = finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['client', 'La Crypta AI Start']],
      content,
    },
    sk,
  );

  const pool = new SimplePool();
  try {
    const results = await Promise.allSettled(pool.publish(relays, event));
    const accepted = results.filter((r) => r.status === 'fulfilled').length;
    return { event, accepted, relays };
  } finally {
    pool.close(relays);
  }
}

/** One-shot read of recent kind-1 notes, deduped and newest-first. */
export async function readFeed(
  limit = 20,
  relays: string[] = getRelays(),
): Promise<Event[]> {
  const pool = new SimplePool();
  try {
    const filter: Filter = { kinds: [1], limit };
    const events = await pool.querySync(relays, filter);
    return events.sort((a, b) => b.created_at - a.created_at);
  } finally {
    pool.close(relays);
  }
}

export { getPublicKey, verifyEvent, nip19 };
export type { Event };
