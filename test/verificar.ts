/**
 * Verificacion sin red y sin gastar tokens.
 * Corre con:  pnpm verificar
 */
import { decode } from "light-bolt11-decoder";
import { nip19 } from "nostr-tools";
import { bech32 } from "@scure/base";
import { route } from "../daemon/router";
import { extraerJson } from "../daemon/agent/json";
import { crearDetectorDoble } from "../daemon/copyEvents";
import { INTENTS, findIntent } from "../daemon/agent/intents";
import { pedirConfirmacion, decidir, leerPendiente } from "../daemon/pending";
import { CONFIG } from "../daemon/config";
import { procesarFactura, type InvoiceDeps, type Decoded } from "../daemon/handlers/invoice";
import * as feed from "../daemon/feed";

async function main() {

let fallos = 0;
const check = (nombre: string, ok: boolean, extra = "") => {
  if (!ok) fallos++;
  console.log((ok ? "OK   " : "FALLA") + " " + nombre.padEnd(42) + extra);
};

const INV =
  "lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp";
const NPUB = "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6";

// Bech32 valido armado en el momento: sin red, sin depender de un LNURL real.
const LNURL = bech32.encode(
  "lnurl",
  bech32.toWords(new TextEncoder().encode("https://example.com/lnurlp/alice")),
  false,
);

const BTC_SEGWIT = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const BTC_LEGACY = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
const BTC_P2SH = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy";

console.log("--- router: reconoce lo que debe ---");
check("factura sola", route(INV).kind === "invoice");
check("factura con prefijo lightning:", route("lightning:" + INV).kind === "invoice");
check("factura en una frase", route("pagame " + INV + " gracias").kind === "invoice");
check("npub solo", route(NPUB).kind === "nostr");
check("npub en texto", route("segui a " + NPUB + " que postea").kind === "nostr");
check("lnurl solo", route(LNURL).kind === "lnurl");
check("lnurl en texto", route("pagame aca " + LNURL).kind === "lnurl");
check("direccion segwit", route(BTC_SEGWIT).kind === "onchain");
check("direccion legacy", route(BTC_LEGACY).kind === "onchain");
check("direccion p2sh", route(BTC_P2SH).kind === "onchain");

console.log("\n--- router: ignora lo que no entiende (privacidad) ---");
check("contrasena", route("Tr0ub4dor&3xKq!zP").kind === "ignore");
check("email", route("alguien@gmail.com").kind === "ignore");
check("url", route("https://lacrypta.dev/hackathons").kind === "ignore");
check("json con token", route('{"user":"seba","token":"abc123"}').kind === "ignore");
check("texto largo", route("a".repeat(300)).kind === "ignore");
check("vacio", route("   ").kind === "ignore");

console.log("\n--- decodificado local de BOLT11 ---");
const p = decode(INV) as { sections: Array<{ name: string; value?: unknown }>; expiry?: number };
const val = (n: string) => p.sections.find((s) => s.name === n)?.value;
check("lee el monto", Math.floor(Number(val("amount")) / 1000) === 250000, "-> 250000 sats");
check("lee el concepto", val("description") === "1 cup coffee");
check("lee el timestamp", typeof val("timestamp") === "number");
check("lee el expiry", typeof p.expiry === "number");

console.log("\n--- nip19 ---");
const d = nip19.decode(NPUB);
check("decodifica npub", d.type === "npub");
check("re-encodea igual", nip19.npubEncode(d.data as string) === NPUB);

console.log("\n--- parseo defensivo del clasificador ---");
const jsonCasos: Array<[string, string, string | null]> = [
  ["json limpio", '{"intent":"traducir"}', "traducir"],
  ["envuelto en fence", '```json\n{"intent":"error"}\n```', "error"],
  ["fence sin lenguaje", '```\n{"intent":"resumir"}\n```', "resumir"],
  ["con preambulo", 'Claro! Aca va:\n{"intent":"explicar"}', "explicar"],
  ["con texto despues", '{"intent":"responder"} espero que sirva', "responder"],
  ["indentado", '{\n  "intent": "reescribir"\n}', "reescribir"],
  ["json roto", '{"intent": traducir}', null],
  ["sin json", "no se que hacer", null],
];
for (const [nombre, entrada, esperado] of jsonCasos) {
  const r = extraerJson(entrada);
  check(nombre, (r && typeof r.intent === "string" ? r.intent : null) === esperado);
}

console.log("\n--- catalogo de intenciones ---");
check("intent inventado no existe", findIntent("bailar") === undefined);
check("hay fallback explicar", findIntent("explicar") !== undefined);
check("todos tienen system prompt", INTENTS.every((i) => i.sistema.length > 20));
check("ids unicos", new Set(INTENTS.map((i) => i.id)).size === INTENTS.length);

console.log("\n--- doble copia ---");
const esDoble = crearDetectorDoble(900);
check("primer copiado no dispara", esDoble() === false);
check("segundo inmediato dispara", esDoble() === true);
check("tercero no re-dispara", esDoble() === false);

const lento = crearDetectorDoble(50);
lento();
await new Promise((r) => setTimeout(r, 120));
check("copiado tardio no dispara", lento() === false);
check("el siguiente rapido si", lento() === true);

console.log("\n--- el agente solo ve lo que el router ignora ---");
check("factura no llega al LLM", route(INV).kind !== "ignore");
check("npub no llega al LLM", route(NPUB).kind !== "ignore");
check("lnurl no llega al LLM", route(LNURL).kind !== "ignore");
check("direccion btc no llega al LLM", route(BTC_SEGWIT).kind !== "ignore");
check("stacktrace si llega", route("TypeError: x of undefined\n at foo.js:12").kind === "ignore");

console.log("\n--- doble copia por numero de secuencia (WSL) ---");
// Replica la logica de index.ts: dos eventos con el MISMO texto dentro de
// la ventana significan que el usuario copio dos veces a proposito.
function simular(eventos: Array<[string, number]>, ventana = 900): boolean[] {
  let ultimoTexto = "";
  let ultimoTs = 0;
  return eventos.map(([texto, ts]) => {
    const doble = texto === ultimoTexto && ts - ultimoTs < ventana;
    ultimoTexto = doble ? "" : texto;
    ultimoTs = ts;
    return doble;
  });
}
const r1 = simular([["hola", 0], ["hola", 300]]);
check("mismo texto rapido = doble", r1[0] === false && r1[1] === true);

const r2 = simular([["hola", 0], ["hola", 2000]]);
check("mismo texto lento = no", r2[1] === false);

const r3 = simular([["hola", 0], ["chau", 200]]);
check("texto distinto = no", r3[1] === false);

const r4 = simular([["hola", 0], ["hola", 200], ["hola", 400]]);
check("tres copias no re-disparan", r4[1] === true && r4[2] === false);

console.log("\n--- ciclo de confirmacion por el feed ---");
const promesa = pedirConfirmacion("Factura Lightning", "21 sats", 4000);
await new Promise((r) => setTimeout(r, 300));
const pend = leerPendiente();
check("la accion queda publicada", pend !== null && pend.titulo === "Factura Lightning");
if (pend) decidir(pend.id, true);
check("aprobar devuelve true", (await promesa) === true);
check("y se limpia el pendiente", leerPendiente() === null);

const promesa2 = pedirConfirmacion("Otra", "1000 sats", 4000);
await new Promise((r) => setTimeout(r, 300));
const pend2 = leerPendiente();
if (pend2) decidir(pend2.id, false);
check("cancelar devuelve false", (await promesa2) === false);

const promesa3 = pedirConfirmacion("Sin respuesta", "999 sats", 700);
check("timeout falla cerrado", (await promesa3) === false);

console.log("\n--- invoice: auto-pago / confirmacion / tope duro (sin red, pago mockeado) ---");

const factura = (sats: number | null, expired = false): Decoded => ({
  sats,
  description: "prueba",
  expired,
  expiresInMin: 30,
});

function mockDeps(opts: { confirmarRespuesta?: boolean; pagarFalla?: boolean } = {}) {
  const llamadas = { pagar: 0, confirmar: 0, avisar: 0 };
  const deps: InvoiceDeps = {
    pagar: async () => {
      llamadas.pagar++;
      if (opts.pagarFalla) throw new Error("nodo caido (mock)");
      return { preimage: "deadbeef".repeat(4), feesPaid: 1 };
    },
    confirmar: async () => {
      llamadas.confirmar++;
      return opts.confirmarRespuesta ?? true;
    },
    avisar: async () => {
      llamadas.avisar++;
    },
  };
  return { deps, llamadas };
}

{
  const { deps, llamadas } = mockDeps();
  await procesarFactura("factura-test", factura(500), deps);
  check(
    "auto-pago bajo el limite paga sin confirmar",
    llamadas.confirmar === 0 && llamadas.pagar === 1,
  );
}

{
  const { deps, llamadas } = mockDeps();
  await procesarFactura("factura-test", factura(CONFIG.autoPayLimitSats), deps);
  check(
    "el limite exacto de auto-pago tambien auto-paga",
    llamadas.confirmar === 0 && llamadas.pagar === 1,
  );
}

{
  const { deps, llamadas } = mockDeps({ confirmarRespuesta: true });
  await procesarFactura("factura-test", factura(CONFIG.autoPayLimitSats + 1), deps);
  check(
    "un sat arriba del limite de auto-pago pide confirmacion",
    llamadas.confirmar === 1 && llamadas.pagar === 1,
  );
}

{
  const { deps, llamadas } = mockDeps({ confirmarRespuesta: false });
  await procesarFactura("factura-test", factura(5000), deps);
  check("rechazar la confirmacion no paga", llamadas.confirmar === 1 && llamadas.pagar === 0);
  const ultima = feed.read(1)[0];
  check("el rechazo queda cancelado en el feed", ultima?.status === "cancelled");
}

{
  const { deps, llamadas } = mockDeps({ confirmarRespuesta: true });
  await procesarFactura("factura-test", factura(CONFIG.maxPaySats + 1), deps);
  check(
    "el tope duro bloquea sin preguntar, ni confirmando se supera",
    llamadas.confirmar === 0 && llamadas.pagar === 0,
  );
  const ultima = feed.read(1)[0];
  check(
    "el tope duro deja rastro en el feed",
    ultima?.status === "error" && ultima?.title === "Bloqueada por el tope de seguridad",
  );
}

{
  const { deps, llamadas } = mockDeps({ confirmarRespuesta: true });
  await procesarFactura("factura-test", factura(null), deps);
  check(
    "factura sin monto (amountless) siempre pide confirmacion",
    llamadas.confirmar === 1 && llamadas.pagar === 1,
  );
}

{
  const { deps, llamadas } = mockDeps({ confirmarRespuesta: true });
  await procesarFactura("factura-test", factura(100, true), deps);
  check(
    "factura vencida no paga ni pregunta",
    llamadas.confirmar === 0 && llamadas.pagar === 0 && llamadas.avisar === 1,
  );
}

{
  const { deps, llamadas } = mockDeps({ pagarFalla: true });
  let reboto = false;
  try {
    await procesarFactura("factura-test", factura(200), deps);
  } catch {
    reboto = true;
  }
  check("un fallo de red al pagar se maneja sin excepcion sin manejar", !reboto && llamadas.pagar === 1);
  const ultima = feed.read(1)[0];
  check("el fallo de pago queda en el feed", ultima?.status === "error" && ultima?.title === "Fallo el pago");
}

console.log("\n" + (fallos === 0 ? "todo verde" : fallos + " fallos"));
process.exit(fallos > 0 ? 1 : 0);

}

main();
