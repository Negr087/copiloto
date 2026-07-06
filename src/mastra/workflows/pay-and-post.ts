import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { generateText } from 'ai';
import { getModel } from '@/lib/model';
import { payInvoice } from '@/lib/lightning';
import { getSecretKeyFromEnv, publishNote } from '@/lib/nostr';

/**
 * The headline showcase: LLM + Lightning + Nostr + Workflow, all in one.
 *
 * 1. draft-note   — the LLM writes a short note (works in BOTH auth modes;
 *                   text generation is fine through the Claude Code provider).
 * 2. pay-invoice  — pays the BOLT11 invoice over NWC (needs NWC_URL).
 * 3. publish-proof— publishes the note + preimage proof to Nostr (needs NOSTR_NSEC).
 *
 * Because the steps call the lib functions directly (not via model tool-calling),
 * this workflow runs the same in subscription mode and API-key mode.
 * Workflow step `execute` destructures { inputData } (note: tools use positional args).
 */

const draftNote = createStep({
  id: 'draft-note',
  inputSchema: z.object({
    invoice: z.string().describe('Factura BOLT11 a pagar'),
    reason: z.string().describe('Motivo del pago, para redactar la nota'),
  }),
  outputSchema: z.object({ invoice: z.string(), note: z.string() }),
  execute: async ({ inputData }) => {
    const { text } = await generateText({
      model: getModel(),
      prompt: `Escribí una nota corta (máximo 180 caracteres) para publicar en Nostr,
anunciando un pago Lightning por: "${inputData.reason}".
Tono entusiasta y natural, en español. Devolvé solo el texto de la nota, sin comillas.`,
    });
    return { invoice: inputData.invoice, note: text.trim() };
  },
});

const payStep = createStep({
  id: 'pay-invoice',
  inputSchema: z.object({ invoice: z.string(), note: z.string() }),
  outputSchema: z.object({ note: z.string(), preimage: z.string() }),
  execute: async ({ inputData }) => {
    const { preimage } = await payInvoice(inputData.invoice);
    return { note: inputData.note, preimage };
  },
});

const publishStep = createStep({
  id: 'publish-proof',
  inputSchema: z.object({ note: z.string(), preimage: z.string() }),
  outputSchema: z.object({
    eventId: z.string(),
    preimage: z.string(),
    accepted: z.number(),
  }),
  execute: async ({ inputData }) => {
    const sk = getSecretKeyFromEnv();
    const content = `${inputData.note}\n\n⚡ preimage: ${inputData.preimage}`;
    const { event, accepted } = await publishNote(sk, content);
    return { eventId: event.id, preimage: inputData.preimage, accepted };
  },
});

export const payAndPostWorkflow = createWorkflow({
  id: 'pay-and-post',
  inputSchema: z.object({
    invoice: z.string().describe('Factura BOLT11 a pagar'),
    reason: z.string().describe('Motivo del pago'),
  }),
  outputSchema: z.object({
    eventId: z.string(),
    preimage: z.string(),
    accepted: z.number(),
  }),
})
  .then(draftNote)
  .then(payStep)
  .then(publishStep)
  .commit();
