import "dotenv/config";
import fs from "node:fs";
import crypto from "node:crypto";
import { CONFIG, PAUSE_FILE } from "./config";
import { detectBackend, readClipboard, isSecret } from "./clipboard";
import { WinClipboardWatcher, type WinCopyEvent } from "./winClipboard";
import { CopyWatcher, crearDetectorDoble } from "./copyEvents";
import { route } from "./router";
import { handleInvoice } from "./handlers/invoice";
import { handleNostr } from "./handlers/npub";
import { handleLnurl } from "./handlers/lnurl";
import { handleOnchain } from "./handlers/onchain";
import { handleAsk } from "./handlers/ask";
import { closeWallet } from "./nwc";
import { closeNostr } from "./nostrClient";
import { notify } from "./notify";

const sha = (s: string) => crypto.createHash("sha1").update(s).digest("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastHash = "";
let running = true;
let ocupado = false;

/**
 * Cuando un handler escribe el resultado en el portapapeles, eso dispara
 * otro evento de copiado. Nos ignoramos a nosotros mismos por un rato.
 */
let silencioHasta = 0;
const enSilencio = () => Date.now() < silencioHasta;
const silenciar = (ms = 1500) => (silencioHasta = Date.now() + ms);

const pausado = () => fs.existsSync(PAUSE_FILE);

/** Ejecuta el handler que corresponda y resincroniza el estado. */
async function despachar(texto: string, forzarAgente = false): Promise<void> {
  if (ocupado) return;

  const { kind, match } = route(texto);

  // El agente solo entra sobre lo que el router NO reconoce, y solo si el
  // usuario lo pidio explicitamente.
  if (forzarAgente && kind !== "ignore") return;
  if (!forzarAgente && kind === "ignore") return;

  ocupado = true;
  const hora = new Date().toLocaleTimeString("es-AR");
  console.log("[" + hora + "] " + (forzarAgente ? "agente" : kind));

  try {
    if (forzarAgente) await handleAsk(texto);
    else if (kind === "invoice") await handleInvoice(match);
    else if (kind === "nostr") await handleNostr(match);
    else if (kind === "lnurl") await handleLnurl(match);
    else if (kind === "onchain") await handleOnchain(match);
  } catch (err) {
    console.error("handler fallo:", err);
  } finally {
    ocupado = false;
  }

  const after = await readClipboard();
  if (after) lastHash = sha(after);
  silenciar();
}

/* ------------------------------------------------------------------ */
/* WSL: eventos reales desde Windows                                   */
/* ------------------------------------------------------------------ */

function arrancarWSL() {
  const watcher = new WinClipboardWatcher();

  let ultimoTexto = "";
  let ultimoTs = 0;

  watcher.on("copy", (ev: WinCopyEvent) => {
    void (async () => {
      if (pausado() || enSilencio() || ocupado) return;

      // Primera barrera: el gestor de contrasenas marco esto como secreto.
      if (ev.secreto) {
        ultimoTexto = "";
        return;
      }

      const texto = ev.texto;
      if (!texto || !texto.trim()) return;

      const ahora = Date.now();

      // Windows incrementa el numero de secuencia en cada copiado, aunque el
      // contenido sea identico. Dos eventos seguidos con el mismo texto = el
      // usuario copio dos veces a proposito.
      const esDobleCopia = texto === ultimoTexto && ahora - ultimoTs < 900;

      ultimoTexto = texto;
      ultimoTs = ahora;

      if (esDobleCopia) {
        ultimoTexto = "";
        await despachar(texto, true);
        return;
      }

      const hash = sha(texto);
      if (hash === lastHash) return;
      lastHash = hash;

      await despachar(texto, false);
    })();
  });

  watcher.on("unavailable", () => {
    console.error("Se corto el puente con Windows. Reinicia el daemon.");
  });

  watcher.start();
  return watcher;
}

/* ------------------------------------------------------------------ */
/* Linux nativo: polling + eventos de Wayland                          */
/* ------------------------------------------------------------------ */

async function tickLinux(): Promise<void> {
  if (ocupado || enSilencio() || pausado()) return;

  if (await isSecret()) {
    lastHash = "__secreto__";
    return;
  }

  const text = await readClipboard();
  if (!text) return;

  const hash = sha(text);
  if (hash === lastHash) return;
  lastHash = hash;

  await despachar(text, false);
}

async function arrancarLinux(): Promise<boolean> {
  const watcher = new CopyWatcher();
  const esDoble = crearDetectorDoble(900);
  const hayEventos = await watcher.start();

  if (hayEventos) {
    watcher.on("copy", () => {
      if (!esDoble()) return;
      void (async () => {
        if (pausado() || enSilencio() || ocupado) return;
        if (await isSecret()) return;
        const texto = await readClipboard();
        if (texto?.trim()) await despachar(texto, true);
      })();
    });
  }

  return hayEventos;
}

/* ------------------------------------------------------------------ */

async function main() {
  const backend = await detectBackend();

  if (backend === "none") {
    console.error(
      "No encontre como leer el portapapeles.\n" +
        "  WSL:     deberia funcionar powershell.exe (revisa el interop)\n" +
        "  Wayland: sudo apt install wl-clipboard\n" +
        "  X11:     sudo apt install xclip",
    );
    process.exit(1);
  }

  if (!fs.existsSync(CONFIG.dataDir)) {
    fs.mkdirSync(CONFIG.dataDir, { recursive: true });
  }

  let modoAgente: string;
  let watcherWSL: WinClipboardWatcher | null = null;

  if (backend === "wsl") {
    watcherWSL = arrancarWSL();
    modoAgente = "doble Ctrl+C (numero de secuencia de Windows)";
  } else {
    const hayEventos = await arrancarLinux();
    modoAgente = hayEventos ? "doble Ctrl+C" : "solo por atajo (pnpm ask)";
  }

  console.log("Copiloto activo (" + backend + ")");
  console.log("  auto-pago hasta " + CONFIG.autoPayLimitSats + " sats");
  console.log("  tope duro      " + CONFIG.maxPaySats + " sats");
  console.log("  wallet NWC     " + (CONFIG.nwcUrl ? "conectada" : "SIN CONFIGURAR"));
  console.log("  modelo         " + (process.env.AI_PROVIDER ?? "subscription"));
  console.log("  agente         " + modoAgente);
  if (backend === "wsl") {
    console.log("  confirmaciones en http://localhost:3000/feed");
  }
  console.log("  pausar con:    touch " + PAUSE_FILE);

  await notify("Copiloto activo", "Lightning, Nostr y el agente escuchando");

  // Marcamos lo que ya estaba copiado para no disparar nada al arrancar.
  const initial = await readClipboard();
  if (initial) lastHash = sha(initial);

  if (backend === "wsl") {
    // El watcher maneja todo por eventos; solo mantenemos vivo el proceso.
    while (running) await sleep(1000);
    watcherWSL?.stop();
  } else {
    while (running) {
      await tickLinux();
      await sleep(CONFIG.pollMs);
    }
  }
}

function shutdown() {
  running = false;
  console.log("\nCerrando...");
  try {
    closeWallet();
    closeNostr();
  } catch {
    // no nos importa fallar al cerrar
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
