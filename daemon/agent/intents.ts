/**
 * Las intenciones que el agente sabe manejar.
 *
 * Cada una define como se comporta en el paso 2. Agregar una intencion nueva
 * es agregar una entrada aca: el clasificador la toma automaticamente.
 */

export interface Intent {
  id: string;
  /** Como se lo explicamos al clasificador. */
  descripcion: string;
  /** El system prompt del paso 2. */
  sistema: string;
  /** Titulo corto para la notificacion. */
  titulo: string;
}

export const INTENTS: Intent[] = [
  {
    id: "traducir",
    descripcion:
      "El texto esta en un idioma extranjero y el usuario querria leerlo en espanol, o esta en espanol y pide traducirlo.",
    sistema:
      "Traduci el texto al espanol rioplatense natural. Si ya esta en espanol, traducilo al ingles. " +
      "Devolve UNICAMENTE la traduccion, sin comillas, sin preambulo, sin explicaciones.",
    titulo: "Traducido",
  },
  {
    id: "error",
    descripcion:
      "Es un stacktrace, un mensaje de error, un log de compilacion o una excepcion de programacion.",
    sistema:
      "Sos un dev senior. Te paso un error. Respondé en maximo 4 lineas: " +
      "que fallo, por que, y el fix concreto. Si el fix es codigo, mostralo. " +
      "Sin introducciones ni cortesias.",
    titulo: "Diagnostico",
  },
  {
    id: "resumir",
    descripcion:
      "Es un texto largo, un articulo, una nota o varios parrafos que conviene condensar.",
    sistema:
      "Resumi en 3 a 5 bullets en espanol rioplatense. Cada bullet una idea concreta. " +
      "Sin titulo, sin preambulo. Solo los bullets.",
    titulo: "Resumen",
  },
  {
    id: "reescribir",
    descripcion:
      "Es un texto que el usuario escribio y querria mejorar: un mensaje, un mail, un tweet.",
    sistema:
      "Reescribi el texto para que quede claro y natural en espanol rioplatense, " +
      "manteniendo el tono y la intencion original. Devolve solo el texto reescrito.",
    titulo: "Reescrito",
  },
  {
    id: "explicar",
    descripcion:
      "Es un termino, un comando, un fragmento de codigo o un concepto que el usuario no entiende.",
    sistema:
      "Explica esto en maximo 4 lineas, en espanol rioplatense, sin vueltas. " +
      "Si es un comando de shell, deci exactamente que hace.",
    titulo: "Explicacion",
  },
  {
    id: "responder",
    descripcion:
      "Es una pregunta directa que el usuario quiere que le contesten.",
    sistema:
      "Respondé la pregunta en maximo 5 lineas, en espanol rioplatense, sin preambulos.",
    titulo: "Respuesta",
  },
];

export const INTENT_IDS = INTENTS.map((i) => i.id);

export function findIntent(id: string): Intent | undefined {
  return INTENTS.find((i) => i.id === id);
}
