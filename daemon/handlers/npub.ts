import { writeClipboard } from "../clipboard";
import { notify } from "../notify";
import { toPubkey, fetchProfile } from "../nostrClient";
import * as feed from "../feed";

function hace(ts: number): string {
  const min = Math.round((Date.now() / 1000 - ts) / 60);
  if (min < 60) return "hace " + min + " min";
  const hs = Math.round(min / 60);
  if (hs < 24) return "hace " + hs + " h";
  return "hace " + Math.round(hs / 24) + " d";
}

export async function handleNostr(entity: string): Promise<void> {
  const pubkey = toPubkey(entity);

  if (!pubkey) {
    feed.append({
      kind: "nostr",
      preview: feed.preview(entity),
      status: "error",
      title: "Entidad Nostr no reconocida",
    });
    return;
  }

  try {
    const p = await fetchProfile(pubkey);
    const nombre = p.name ?? "sin nombre";

    const partes = [
      nombre,
      p.nip05 ? "verificado como " + p.nip05 : null,
      p.recentNotes + " notas en 30 dias",
      p.lastNote ? "ultima " + hace(p.lastNote.created_at) : null,
    ].filter(Boolean);

    const resumen = partes.join(" - ");

    // El resumen completo vuelve al portapapeles: Ctrl+V y lo pegas donde quieras.
    const full = [
      nombre + (p.nip05 ? " (" + p.nip05 + ")" : ""),
      p.about ? "\n" + p.about : "",
      "\n\n" + p.recentNotes + " notas en los ultimos 30 dias",
      p.lastNote ? "\nUltima nota (" + hace(p.lastNote.created_at) + "): " + p.lastNote.content.slice(0, 200) : "",
      "\n\n" + p.npub,
    ].join("");

    await writeClipboard(full);
    await notify(nombre, resumen);

    feed.append({
      kind: "nostr",
      preview: feed.preview(entity),
      status: "ok",
      title: nombre,
      detail: resumen,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    await notify("No pude leer el perfil", msg);
    feed.append({
      kind: "nostr",
      preview: feed.preview(entity),
      status: "error",
      title: "No pude leer el perfil",
      detail: msg,
    });
  }
}
