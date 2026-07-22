import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "./config";

/**
 * Confirmaciones a traves del feed web.
 *
 * En WSL no hay notificaciones de escritorio, asi que la confirmacion se
 * muestra en la pantalla que igual vas a estar proyectando. Termina siendo
 * mejor para la demo: todo pasa en un solo lugar.
 *
 * IPC por archivos, igual que el feed. Sin sockets ni puertos extra.
 */

export interface PendingAction {
  id: string;
  ts: number;
  titulo: string;
  detalle: string;
  /** Se cancela sola pasado este tiempo. */
  expiraEn: number;
}

const PENDING_FILE = () => path.join(CONFIG.dataDir, "pending.json");
const DECISION_FILE = (id: string) => path.join(CONFIG.dataDir, "decision-" + id + ".json");

function ensureDir() {
  if (!fs.existsSync(CONFIG.dataDir)) fs.mkdirSync(CONFIG.dataDir, { recursive: true });
}

export function leerPendiente(): PendingAction | null {
  try {
    const raw = fs.readFileSync(PENDING_FILE(), "utf8");
    const p = JSON.parse(raw) as PendingAction;
    if (Date.now() > p.expiraEn) return null;
    return p;
  } catch {
    return null;
  }
}

export function limpiarPendiente() {
  try {
    fs.unlinkSync(PENDING_FILE());
  } catch {
    // ya no estaba
  }
}

/** La UI llama esto cuando el usuario aprieta un boton. */
export function decidir(id: string, aprobado: boolean) {
  ensureDir();
  fs.writeFileSync(DECISION_FILE(id), JSON.stringify({ aprobado, ts: Date.now() }), "utf8");
  limpiarPendiente();
}

function leerDecision(id: string): boolean | null {
  try {
    const raw = fs.readFileSync(DECISION_FILE(id), "utf8");
    return (JSON.parse(raw) as { aprobado: boolean }).aprobado;
  } catch {
    return null;
  }
}

/**
 * Publica la accion y espera la respuesta del usuario.
 * Falla cerrado: si vence el tiempo, devuelve false.
 */
export async function pedirConfirmacion(
  titulo: string,
  detalle: string,
  timeoutMs = 45_000,
): Promise<boolean> {
  ensureDir();

  const id = Math.random().toString(36).slice(2, 10);
  const accion: PendingAction = {
    id,
    ts: Date.now(),
    titulo,
    detalle,
    expiraEn: Date.now() + timeoutMs,
  };

  fs.writeFileSync(PENDING_FILE(), JSON.stringify(accion), "utf8");

  const hasta = Date.now() + timeoutMs;

  while (Date.now() < hasta) {
    const d = leerDecision(id);
    if (d !== null) {
      try {
        fs.unlinkSync(DECISION_FILE(id));
      } catch {
        // no importa
      }
      limpiarPendiente();
      return d;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  limpiarPendiente();
  return false;
}
