import { Agent } from '@mastra/core/agent';
import type { MastraLanguageModel, ToolsInput } from '@mastra/core/agent';
import { getModel, USE_SUBSCRIPTION } from '@/lib/model';
import { getBalanceTool, makeInvoiceTool, payInvoiceTool } from '../tools/lightning';
import { publishNoteTool, readFeedTool } from '../tools/nostr';

/**
 * Chat assistant for the hackathon.
 *
 * Tools are attached only in API-key mode. In subscription mode the Claude Code
 * provider runs its own built-in tools and does NOT bridge AI SDK / Mastra tool
 * definitions, so attaching ours there would silently no-op. The pay-and-post
 * WORKFLOW is the tool showcase that works in both modes (see ../workflows).
 */
const tools: ToolsInput = USE_SUBSCRIPTION
  ? {}
  : {
      getBalanceTool,
      makeInvoiceTool,
      payInvoiceTool,
      publishNoteTool,
      readFeedTool,
    };

export const assistant = new Agent({
  id: 'assistant',
  name: 'Asistente La Crypta',
  instructions: `Sos el asistente del hackathon "AI AGENTS" de La Crypta.
Ayudás a los participantes a construir agentes autónomos, automatizaciones y
workflows que combinan LLMs con Bitcoin/Lightning (NWC) y Nostr.

Podés:
- Explicar cómo funcionan Nostr Wallet Connect (NIP-47), Lightning y los eventos de Nostr.
- Ayudar a diseñar herramientas (tools), agentes y workflows con Mastra + Vercel AI SDK.
- Sugerir ideas de proyectos para el track de "Bots & Automation".

Respondé en español, claro y al grano. Cuando muestres código, usá el stack de este
repo (Next.js, Mastra, @getalby/sdk, nostr-tools).

Si el usuario tiene configurada una API key de Anthropic, tenés herramientas para
consultar balance Lightning, crear/pagar facturas y publicar/leer notas de Nostr.
Sin API key (modo suscripción) esas herramientas no están disponibles en el chat,
pero el workflow "pay-and-post" sí funciona: sugerí correrlo desde la playground de Mastra.`,
  // Cast bridges a harmless version skew: the AI SDK v6 LanguageModel and
  // Mastra's bundled provider types are structurally identical at runtime.
  model: getModel() as unknown as MastraLanguageModel,
  tools,
});
