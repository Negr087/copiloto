import { generateText } from "ai";
import { getModel } from "./model";
import { INTENTS, INTENT_IDS, findIntent, type Intent } from "./intents";
import { extraerJson } from "./json";

export interface AgentResult {
  intent: string;
  titulo: string;
  salida: string;
  /** Cuanto tardo cada paso, para mostrarlo en el feed durante la demo. */
  msClasificar: number;
  msActuar: number;
}

/**
 * PASO 1 - Clasificar.
 *
 * Esto es lo que convierte el sistema en un agente y no en un router: nadie
 * le dijo que hacer con este contenido. Lo decide el.
 */
async function clasificar(texto: string): Promise<Intent> {
  const catalogo = INTENTS.map((i) => "- " + i.id + ": " + i.descripcion).join("\n");

  // Recortamos: para clasificar no hace falta el texto entero y ahorra tokens.
  const muestra = texto.length > 1200 ? texto.slice(0, 1200) + "\n[...]" : texto;

  const { text } = await generateText({
    model: await getModel(),
    temperature: 0,
    system:
      "Sos un clasificador de intenciones. El usuario copio un texto al portapapeles " +
      "y quiere que un agente haga algo util con el.\n\n" +
      "Intenciones disponibles:\n" + catalogo + "\n\n" +
      'Respondé UNICAMENTE con JSON: {"intent":"<id>","confianza":<0-1>}\n' +
      "Sin explicaciones, sin markdown.",
    prompt: "Texto copiado:\n\n" + muestra,
  });

  const json = extraerJson(text);
  const id = typeof json?.intent === "string" ? json.intent : "";

  // Si el modelo inventa una intencion, caemos a "explicar", que es el
  // comportamiento menos sorprendente para contenido ambiguo.
  return findIntent(id) ?? findIntent("explicar")!;
}

/**
 * PASO 2 - Actuar.
 *
 * Sin tools: llamamos al modelo con el system prompt de la intencion elegida.
 * Esto es a proposito, para que funcione igual con el proveedor de
 * suscripcion (Claude Pro), que no puentea las tools del AI SDK.
 */
async function actuar(texto: string, intent: Intent): Promise<string> {
  const { text } = await generateText({
    model: await getModel(),
    temperature: 0.3,
    system: intent.sistema,
    prompt: texto,
  });

  return text.trim();
}

export async function correrAgente(texto: string): Promise<AgentResult> {
  const t0 = Date.now();
  const intent = await clasificar(texto);
  const t1 = Date.now();
  const salida = await actuar(texto, intent);
  const t2 = Date.now();

  return {
    intent: intent.id,
    titulo: intent.titulo,
    salida,
    msClasificar: t1 - t0,
    msActuar: t2 - t1,
  };
}

/** Solo para probar la clasificacion sin gastar el segundo paso. */
export async function soloClasificar(texto: string): Promise<string> {
  return (await clasificar(texto)).id;
}

export { INTENT_IDS };
