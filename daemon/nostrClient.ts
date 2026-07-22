import { SimplePool, nip19 } from "nostr-tools";
import { CONFIG } from "./config";

let pool: SimplePool | null = null;

function getPool(): SimplePool {
  if (!pool) pool = new SimplePool();
  return pool;
}

export interface Profile {
  pubkey: string;
  npub: string;
  name?: string;
  about?: string;
  nip05?: string;
  picture?: string;
  recentNotes: number;
  lastNote?: { content: string; created_at: number };
}

/** Acepta npub, nprofile, nevent o note y devuelve siempre el pubkey del autor. */
export function toPubkey(entity: string): string | null {
  try {
    const decoded = nip19.decode(entity);
    switch (decoded.type) {
      case "npub":
        return decoded.data as string;
      case "nprofile":
        return (decoded.data as { pubkey: string }).pubkey;
      case "nevent":
        return (decoded.data as { author?: string }).author ?? null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function fetchProfile(pubkey: string): Promise<Profile> {
  const p = getPool();
  const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;

  const [metaEvents, noteEvents] = await Promise.all([
    p.querySync(CONFIG.relays, { kinds: [0], authors: [pubkey], limit: 1 }),
    p.querySync(CONFIG.relays, { kinds: [1], authors: [pubkey], since, limit: 200 }),
  ]);

  let meta: Record<string, string> = {};
  if (metaEvents[0]) {
    try {
      meta = JSON.parse(metaEvents[0].content);
    } catch {
      meta = {};
    }
  }

  const sorted = [...noteEvents].sort((a, b) => b.created_at - a.created_at);

  return {
    pubkey,
    npub: nip19.npubEncode(pubkey),
    name: meta.display_name || meta.name,
    about: meta.about,
    nip05: meta.nip05,
    picture: meta.picture,
    recentNotes: noteEvents.length,
    lastNote: sorted[0]
      ? { content: sorted[0].content, created_at: sorted[0].created_at }
      : undefined,
  };
}

export function closeNostr() {
  pool?.close(CONFIG.relays);
  pool = null;
}
