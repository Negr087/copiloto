/**
 * Extrae el primer objeto JSON de una respuesta del modelo.
 *
 * Los modelos a veces envuelven el JSON en ```json ... ``` o le agregan una
 * frase antes. En vez de pelearla con el prompt, parseamos defensivamente:
 * es mas barato que un reintento.
 */
export function extraerJson(texto: string): Record<string, unknown> | null {
  const limpio = texto.replace(/```(?:json)?/gi, "").trim();
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio === -1 || fin === -1 || fin < inicio) return null;

  try {
    return JSON.parse(limpio.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}
