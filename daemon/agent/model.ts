import type { LanguageModel } from "ai";
import { pedirConfirmacion } from "../pending";

/**
 * Resuelve el modelo segun AI_PROVIDER, igual que lib/model.ts del boilerplate.
 *
 * Lo mantenemos autocontenido para que el daemon no dependa de la firma exacta
 * de ese archivo. Si preferis unificar, reemplaza esto por:
 *   import { getModel } from "@/lib/model";
 *
 * Default: "subscription" = tu Claude Pro. Costo cero.
 */
export async function getModel(): Promise<LanguageModel> {
  const provider = process.env.AI_PROVIDER ?? "subscription";
  const modelId = process.env.MODEL_ID?.trim();

  switch (provider) {
    case "subscription": {
      // Corre el CLI de Claude Code como subproceso, que trae sus PROPIAS
      // herramientas (bash, archivos, web) separadas de todo lo que define
      // este daemon. canUseTool es el UNICO que decide: nombrar una
      // herramienta en allowedTools la auto-aprueba antes de que canUseTool
      // se llegue a llamar (nos paso probando esto), asi que dejamos esa
      // lista vacia y filtramos aca adentro. Solo WebFetch puede pedir
      // permiso, y lo hace por el mismo camino que una factura: una
      // tarjeta en el feed web, con timeout que falla cerrado si no
      // contestas. Cualquier otra herramienta se deniega sin preguntar.
      const { claudeCode } = await import("ai-sdk-provider-claude-code");
      return claudeCode(modelId || "opus", {
        canUseTool: async (toolName, input, options) => {
          if (toolName !== "WebFetch") {
            return { behavior: "deny", message: "Herramienta no permitida." };
          }

          const aprobado = await pedirConfirmacion(
            options.title ?? "Autorizar " + toolName,
            options.description ?? (typeof input.url === "string" ? input.url : JSON.stringify(input)),
          );
          return aprobado
            ? { behavior: "allow", updatedInput: input }
            : { behavior: "deny", message: "El usuario no autorizo esta herramienta." };
        },
      });
    }

    case "anthropic": {
      const { anthropic } = await import("@ai-sdk/anthropic");
      return anthropic(modelId || "claude-opus-4-8");
    }

    case "openai": {
      const { openai } = await import("@ai-sdk/openai");
      return openai(modelId || "gpt-4o");
    }

    case "gateway": {
      // El gateway se resuelve por string: "proveedor/modelo".
      return (modelId || "anthropic/claude-opus-4-8") as unknown as LanguageModel;
    }

    default:
      throw new Error("AI_PROVIDER desconocido: " + provider);
  }
}

/** El proveedor de suscripcion no puentea tools del AI SDK. */
export function supportsTools(): boolean {
  return (process.env.AI_PROVIDER ?? "subscription") !== "subscription";
}
