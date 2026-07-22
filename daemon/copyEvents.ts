import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { detectBackend } from "./clipboard";

/**
 * Detector de eventos de copiado.
 *
 * El polling compara contenido, asi que no puede distinguir "copie de nuevo
 * lo mismo" de "no paso nada". Para el doble Ctrl+C necesitamos eventos, no
 * estado.
 *
 * `wl-paste --watch` ejecuta un comando cada vez que aparece una seleccion
 * nueva en Wayland, incluso si el contenido es identico. Cada linea que
 * imprime es un evento de copiado.
 *
 * En X11 no hay equivalente sin instalar clipnotify, asi que ahi el disparador
 * del agente es el atajo de teclado (ver daemon/ask.ts).
 */
export class CopyWatcher extends EventEmitter {
  private proc: ChildProcess | null = null;

  async start(): Promise<boolean> {
    const backend = await detectBackend();
    if (backend !== "wayland") return false;

    this.proc = spawn("wl-paste", ["--watch", "echo", "copy"], {
      stdio: ["ignore", "pipe", "ignore"],
    });

    this.proc.stdout?.on("data", (chunk: Buffer) => {
      // Un evento por linea. Si llegan varias juntas, emitimos una por cada una.
      const n = chunk.toString().split("\n").filter(Boolean).length;
      for (let i = 0; i < n; i++) this.emit("copy");
    });

    this.proc.on("error", () => this.emit("unavailable"));

    return true;
  }

  stop() {
    this.proc?.kill();
    this.proc = null;
  }
}

/**
 * Convierte una racha de eventos en una senal de "doble copia".
 * Devuelve true cuando detecta el segundo evento dentro de la ventana.
 */
export function crearDetectorDoble(ventanaMs = 900) {
  let ultimo = 0;

  return function esDoble(): boolean {
    const ahora = Date.now();
    const doble = ahora - ultimo < ventanaMs;
    // Consumimos el evento: tres copias seguidas no disparan dos veces.
    ultimo = doble ? 0 : ahora;
    return doble;
  };
}
