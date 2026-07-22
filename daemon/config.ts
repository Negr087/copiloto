/**
 * Configuracion central del daemon.
 * Todo se lee de .env para no hardcodear nada sensible.
 */

import path from "node:path";

export const CONFIG = {
  /** Cada cuanto miramos el portapapeles (ms). 400ms es imperceptible y no gasta CPU. */
  pollMs: Number(process.env.CLIP_POLL_MS ?? 400),

  /** Facturas por debajo de este monto se pagan sin preguntar. 0 = preguntar siempre. */
  autoPayLimitSats: Number(process.env.CLIP_AUTOPAY_SATS ?? 1000),

  /** Tope duro. Nunca pagamos por encima de esto, ni siquiera con confirmacion. */
  maxPaySats: Number(process.env.CLIP_MAX_PAY_SATS ?? 50000),

  /** Conexion NWC. Mismo formato que usa el boilerplate. */
  nwcUrl: process.env.NWC_URL ?? "",

  relays: (process.env.NOSTR_RELAYS ?? "wss://relay.damus.io,wss://nos.lol")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean),

  /** Donde guardamos el feed que proyectamos en la demo. */
  dataDir: path.resolve(process.cwd(), ".data"),

  /** Cuantos eventos guardamos antes de rotar el archivo. */
  feedMaxEntries: 500,
};

export const PAUSE_FILE = path.join(CONFIG.dataDir, "paused");
export const FEED_FILE = path.join(CONFIG.dataDir, "feed.jsonl");

/**
 * Tipos MIME que los gestores de contrasenas usan para marcar
 * que lo copiado es secreto y no debe ser procesado por terceros.
 * Si vemos cualquiera de estos, ni miramos el contenido.
 */
export const SECRET_MIME_HINTS = [
  "x-kde-passwordManagerHint",
  "application/x-secret",
  "x-keepassxc-hint",
];
