import { read } from "@/daemon/feed";
import { leerPendiente } from "@/daemon/pending";
import { CONFIG } from "@/daemon/config";
import fs from "node:fs";

export const dynamic = "force-dynamic";

function snapshot(): string {
  return JSON.stringify({ entries: read(50), pending: leerPendiente() });
}

/**
 * Empuja feed + pendiente por SSE en vez de que el cliente los pida por
 * polling. fs.watch en .data dispara el push apenas el daemon escribe;
 * el heartbeat de abajo es la red de seguridad (algunos filesystems no
 * emiten eventos de watch de forma confiable, y ademas es lo unico que
 * hace desaparecer un pendiente que vencio sin que nadie lo decida).
 */
export async function GET() {
  const encoder = new TextEncoder();
  let watcher: fs.FSWatcher | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let last = "";
      const send = () => {
        const data = snapshot();
        if (data === last) return;
        last = data;
        controller.enqueue(encoder.encode("data: " + data + "\n\n"));
      };

      send();

      try {
        if (!fs.existsSync(CONFIG.dataDir)) fs.mkdirSync(CONFIG.dataDir, { recursive: true });
        watcher = fs.watch(CONFIG.dataDir, send);
      } catch {
        // Sin watch disponible, el heartbeat de abajo igual mantiene esto vivo.
      }

      heartbeat = setInterval(send, 1000);
    },
    cancel() {
      watcher?.close();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
