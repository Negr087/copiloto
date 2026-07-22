import "dotenv/config";
import { readClipboard, isSecret, detectBackend } from "./clipboard";
import { route } from "./router";
import { handleAsk } from "./handlers/ask";
import { notify } from "./notify";

/**
 * Entrada one-shot para atar a un atajo de teclado.
 *
 * En GNOME: Configuracion > Teclado > Atajos personalizados
 *   Nombre:  Preguntarle al agente
 *   Comando: bash -lc "cd /ruta/al/repo && pnpm ask"
 *   Atajo:   Super+A
 *
 * Es el camino confiable en cualquier sesion (Wayland o X11) y deja
 * explicito que el usuario pidio esto: nada se manda solo.
 */
async function main() {
  const backend = await detectBackend();
  if (backend === "none") {
    console.error("Falta wl-clipboard o xclip.");
    process.exit(1);
  }

  if (await isSecret()) {
    await notify("Contenido protegido", "Es un secreto de tu gestor de contrasenas.");
    process.exit(0);
  }

  const texto = await readClipboard();
  if (!texto || !texto.trim()) {
    await notify("Portapapeles vacio", "Copia algo primero.");
    process.exit(0);
  }

  // Si es una factura o un npub, ya lo maneja el daemon automaticamente.
  const { kind } = route(texto);
  if (kind !== "ignore") {
    await notify("Ya lo maneja el daemon", "Esto es " + kind + ", no hace falta preguntar.");
    process.exit(0);
  }

  await handleAsk(texto);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
