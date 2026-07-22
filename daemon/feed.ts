import fs from "node:fs";
import path from "node:path";
import { CONFIG, FEED_FILE } from "./config";

export interface FeedEntry {
  id: string;
  ts: number;
  kind: string;
  /** Version corta y segura de lo copiado. Nunca guardamos el contenido completo. */
  preview: string;
  status: "ok" | "error" | "cancelled" | "pending";
  title: string;
  detail?: string;
}

function ensureDir() {
  if (!fs.existsSync(CONFIG.dataDir)) {
    fs.mkdirSync(CONFIG.dataDir, { recursive: true });
  }
}

/**
 * Trunca lo copiado para el feed. Un npub o una factura son publicos,
 * pero igual mostramos solo las puntas: en la demo se proyecta esta pantalla.
 */
export function preview(text: string, keep = 14): string {
  const t = text.trim();
  if (t.length <= keep * 2 + 3) return t;
  return t.slice(0, keep) + "..." + t.slice(-keep);
}

export function append(entry: Omit<FeedEntry, "id" | "ts">): FeedEntry {
  ensureDir();
  const full: FeedEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2, 10),
    ts: Date.now(),
  };
  fs.appendFileSync(FEED_FILE, JSON.stringify(full) + "\n", "utf8");
  rotate();
  return full;
}

export function read(limit = 50): FeedEntry[] {
  if (!fs.existsSync(FEED_FILE)) return [];
  const lines = fs.readFileSync(FEED_FILE, "utf8").split("\n").filter(Boolean);
  return lines
    .slice(-limit)
    .map((l) => {
      try {
        return JSON.parse(l) as FeedEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is FeedEntry => e !== null)
    .reverse();
}

function rotate() {
  const lines = fs.readFileSync(FEED_FILE, "utf8").split("\n").filter(Boolean);
  if (lines.length > CONFIG.feedMaxEntries) {
    const keep = lines.slice(-CONFIG.feedMaxEntries);
    fs.writeFileSync(FEED_FILE, keep.join("\n") + "\n", "utf8");
  }
}

export { FEED_FILE, path };
