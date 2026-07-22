import type { LanguageModel } from "ai";

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
      // Corre el CLI de Claude Code como subproceso. Solo Node local,
      // que es exactamente donde vive este daemon.
      const { claudeCode } = await import("ai-sdk-provider-claude-code");
      return claudeCode(modelId || "opus");
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
