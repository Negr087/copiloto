import { run, has } from "./shell";
import { SECRET_MIME_HINTS } from "./config";
import { isWSL, readWin, writeWin } from "./winClipboard";

export type Backend = "wsl" | "wayland" | "x11" | "none";

let cached: Backend | null = null;

/**
 * Detectamos una vez y cacheamos.
 *
 * WSL va primero: adentro de WSL puede existir wl-paste (via WSLg) pero lee
 * un portapapeles distinto al que usa el usuario en Windows. El que importa
 * es el de Windows.
 */
export async function detectBackend(): Promise<Backend> {
  if (cached) return cached;

  if (isWSL() && (await has("powershell.exe"))) {
    cached = "wsl";
  } else if (process.env.WAYLAND_DISPLAY && (await has("wl-paste"))) {
    cached = "wayland";
  } else if (process.env.DISPLAY && (await has("xclip"))) {
    cached = "x11";
  } else if (await has("wl-paste")) {
    cached = "wayland";
  } else if (await has("xclip")) {
    cached = "x11";
  } else {
    cached = "none";
  }

  return cached;
}

/** Lista los tipos MIME disponibles (solo Linux nativo). */
export async function listTypes(): Promise<string[]> {
  const backend = await detectBackend();

  if (backend === "wayland") {
    const { stdout, code } = await run("wl-paste", ["--list-types"]);
    if (code !== 0) return [];
    return stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  }

  if (backend === "x11") {
    const { stdout, code } = await run("xclip", [
      "-o", "-selection", "clipboard", "-t", "TARGETS",
    ]);
    if (code !== 0) return [];
    return stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  }

  return [];
}

/**
 * La regla de privacidad mas importante del proyecto: si el gestor de
 * contrasenas marco el contenido como secreto, no lo tocamos.
 *
 * En WSL esta deteccion viaja adentro de cada evento del watcher (Windows usa
 * formatos de portapapeles, no MIME types), asi que aca devolvemos false y
 * el chequeo real lo hace el watcher.
 */
export async function isSecret(): Promise<boolean> {
  const backend = await detectBackend();
  if (backend === "wsl") return false;

  const types = await listTypes();
  return types.some((t) =>
    SECRET_MIME_HINTS.some((hint) => t.toLowerCase().includes(hint.toLowerCase())),
  );
}

/** Lee el portapapeles como texto. null si esta vacio o no es texto. */
export async function readClipboard(): Promise<string | null> {
  const backend = await detectBackend();

  if (backend === "wsl") return readWin();

  if (backend === "wayland") {
    const { stdout, code } = await run("wl-paste", ["-n", "-t", "text/plain"]);
    if (code !== 0) return null;
    return stdout || null;
  }

  if (backend === "x11") {
    const { stdout, code } = await run("xclip", ["-o", "-selection", "clipboard"]);
    if (code !== 0) return null;
    return stdout || null;
  }

  return null;
}

/** Devuelve el resultado al portapapeles: el usuario solo hace Ctrl+V. */
export async function writeClipboard(text: string): Promise<boolean> {
  const backend = await detectBackend();

  if (backend === "wsl") return writeWin(text);

  if (backend === "wayland") {
    const { code } = await run("wl-copy", [], text);
    return code === 0;
  }

  if (backend === "x11") {
    const { code } = await run("xclip", ["-selection", "clipboard", "-i"], text);
    return code === 0;
  }

  return false;
}

export { isWSL };
