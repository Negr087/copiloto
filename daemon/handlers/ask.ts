import { writeClipboard } from "../clipboard";
import { notify } from "../notify";
import { correrAgente } from "../agent/pipeline";
import * as feed from "../feed";

/**
 * Handler #3: el fallback agentico.
 *
 * A diferencia de los otros dos, este NUNCA se dispara solo. Requiere una
 * accion explicita del usuario (doble Ctrl+C o el atajo de teclado), porque
 * es el unico camino por el que el contenido sale de la maquina.
 */
export async function handleAsk(texto: string): Promise<void> {
  const entry = feed.append({
    kind: "agente",
    preview: feed.preview(texto, 24),
    status: "pending",
    title: "Pensando...",
  });

  await notify("Pensando...", feed.preview(texto, 30));

  try {
    const res = await correrAgente(texto);

    // El resultado vuelve al portapapeles: Ctrl+V y listo.
    await writeClipboard(res.salida);

    const primeraLinea = res.salida.split("\n")[0].slice(0, 90);
    await notify(res.titulo + " (listo para pegar)", primeraLinea);

    feed.append({
      kind: "agente",
      preview: feed.preview(texto, 24),
      status: "ok",
      title: res.titulo,
      detail:
        res.salida.slice(0, 240) +
        "  [" + res.intent + " - " + (res.msClasificar + res.msActuar) + "ms]",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    await notify("El agente fallo", msg);

    feed.append({
      kind: "agente",
      preview: feed.preview(texto, 24),
      status: "error",
      title: "El agente fallo",
      detail: msg,
    });
  }

  void entry;
}
