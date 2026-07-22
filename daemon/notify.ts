import { run, has } from "./shell";
import { isWSL } from "./winClipboard";
import { pedirConfirmacion } from "./pending";

let supportsActions: boolean | null = null;

/**
 * notify-send gano el flag --action recien en libnotify 0.8.
 * Ubuntu 24.04+ lo tiene; en versiones viejas caemos a zenity.
 */
async function detectActionSupport(): Promise<boolean> {
  if (supportsActions !== null) return supportsActions;
  const { stdout, stderr } = await run("notify-send", ["--help"]);
  supportsActions = (stdout + stderr).includes("--action");
  return supportsActions;
}

/** Notificacion informativa, sin botones. No bloquea. */
export async function notify(title: string, body = ""): Promise<void> {
  // En WSL las notificaciones informativas van al feed y a la consola.
  // No vale la pena pelear con toasts de Windows para algo no bloqueante.
  if (isWSL()) {
    console.log("[" + title + "] " + body);
    return;
  }

  if (await has("notify-send")) {
    await run("notify-send", ["-a", "Copiloto", "-t", "6000", title, body]);
    return;
  }
  console.log("[notif] " + title + " - " + body);
}

/**
 * Notificacion con botones. Devuelve la clave de la accion elegida,
 * o null si el usuario la ignoro o la descarto.
 *
 * Bloquea hasta que el usuario responde o vence el timeout, que es
 * exactamente lo que queremos antes de mover plata.
 */
export async function confirm(
  title: string,
  body: string,
  okLabel = "Pagar",
  cancelLabel = "Cancelar",
): Promise<boolean> {
  // En WSL no hay demonio de notificaciones: confirmamos en el feed web,
  // que es la pantalla que se proyecta durante la demo.
  if (isWSL()) {
    console.log("[confirmar] " + title + " - esperando en /feed");
    return pedirConfirmacion(title, body);
  }

  if ((await has("notify-send")) && (await detectActionSupport())) {
    const { stdout } = await run("notify-send", [
      "-a", "Copiloto",
      "-u", "critical",
      "-t", "30000",
      "-A", "ok=" + okLabel,
      "-A", "cancel=" + cancelLabel,
      title,
      body,
    ]);
    return stdout.trim() === "ok";
  }

  // Fallback: dialogo de zenity. Menos elegante pero funciona en cualquier lado.
  if (await has("zenity")) {
    const { code } = await run("zenity", [
      "--question",
      "--title=" + title,
      "--text=" + body,
      "--ok-label=" + okLabel,
      "--cancel-label=" + cancelLabel,
    ]);
    return code === 0;
  }

  // Sin entorno grafico no confirmamos nada. Fallar cerrado, no abierto.
  console.log("[confirm] sin notify-send ni zenity, se cancela por seguridad");
  return false;
}
