import { generateText } from "ai";
import { getModel } from "../agent/model";
import { getSecretKeyFromEnv, publishNote } from "@/lib/nostr";
import * as feed from "../feed";

/**
 * Tras un pago, redacta una nota corta con el LLM y publica la prueba
 * (nota + preimage) en Nostr.
 *
 * Opt-in por NOSTR_NSEC: si no esta configurada, no hacemos nada (ni
 * feed, ni error). Cualquier fallo despues de eso queda en el feed pero
 * nunca se propaga: un pago ya confirmado no puede fallar por Nostr.
 */
export async function publicarProbaDePago(motivo: string, preimage: string): Promise<void> {
  const nsec = process.env.NOSTR_NSEC?.trim();
  if (!nsec) return;

  try {
    const { text } = await generateText({
      model: await getModel(),
      temperature: 0.3,
      prompt:
        "Escribi una nota corta (maximo 180 caracteres) para publicar en Nostr, " +
        'anunciando un pago Lightning por: "' + motivo + '". ' +
        "Tono entusiasta y natural, en espanol. Devolve solo el texto de la nota, sin comillas.",
    });

    const nota = text.trim();
    const sk = getSecretKeyFromEnv();
    const content = nota + "\n\n⚡ preimage: " + preimage;
    const { event, accepted } = await publishNote(sk, content);

    feed.append({
      kind: "nostr",
      preview: feed.preview(content),
      status: "ok",
      title: "Publicado en Nostr",
      detail: nota + " - " + accepted + " relay(s) - " + event.id.slice(0, 12) + "...",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    feed.append({
      kind: "nostr",
      preview: feed.preview(motivo),
      status: "error",
      title: "No pude publicar la prueba en Nostr",
      detail: msg,
    });
  }
}
