/**
 * Router determinista. Cero LLM, cero costo, cero latencia.
 *
 * Esta es la pieza que hace viable el proyecto: el 100% de los casos del MVP
 * se resuelven con regex. Nada sale de la maquina si no matchea una regla
 * conocida, lo cual resuelve el problema de privacidad de raiz en vez de
 * parchearlo despues.
 */

export type Kind = "invoice" | "nostr" | "lnurl" | "onchain" | "ignore";

export interface Route {
  kind: Kind;
  /** El fragmento exacto que matcheo, ya normalizado. */
  match: string;
}

/**
 * BOLT11. Prefijo de red (bc/tb/bcrt/sb), monto opcional, separador "1"
 * y payload en charset bech32 (que excluye 1, b, i, o).
 */
const BOLT11 =
  /ln(?:bc|tb|bcrt|sb)[0-9]*[munp]?1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{100,}/i;

/** Entidades NIP-19: npub, nprofile, nevent, note. */
const NIP19 =
  /\b(?:npub1|nprofile1|nevent1|note1)[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,}\b/i;

/** LUD-01: bech32 "lnurl1..." que adentro codifica una URL. */
const LNURL = /\blnurl1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,}\b/i;

/**
 * Direccion Bitcoin on-chain. Dos familias, alfabetos distintos:
 * bech32/bech32m (segwit v0 "bc1q...", taproot v1 "bc1p...") y
 * base58check legado (P2PKH "1...", P2SH "3...", sin 0/O/I/l).
 * Sin prefijo testnet (tb1/2-3) a proposito: esto paga con plata real.
 */
const BTC_BECH32 = /\bbc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,80}\b/i;
const BTC_BASE58 = /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/;

/** Mas largo que esto no es un identificador, es un documento. Lo ignoramos. */
const MAX_LEN = 4000;

export function route(raw: string): Route {
  const text = raw.trim();

  if (!text || text.length > MAX_LEN) {
    return { kind: "ignore", match: "" };
  }

  // Lightning primero: es la accion con consecuencias, queremos maxima prioridad.
  const invoice = text.match(BOLT11);
  if (invoice) {
    return { kind: "invoice", match: invoice[0].toLowerCase() };
  }

  const lnurl = text.match(LNURL);
  if (lnurl) {
    return { kind: "lnurl", match: lnurl[0].toLowerCase() };
  }

  const nostr = text.match(NIP19);
  if (nostr) {
    return { kind: "nostr", match: nostr[0].toLowerCase() };
  }

  const bech32Addr = text.match(BTC_BECH32);
  if (bech32Addr) {
    return { kind: "onchain", match: bech32Addr[0].toLowerCase() };
  }

  const base58Addr = text.match(BTC_BASE58);
  if (base58Addr) {
    return { kind: "onchain", match: base58Addr[0] };
  }

  return { kind: "ignore", match: "" };
}
