import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getBalanceSats, makeInvoice, payInvoice } from '@/lib/lightning';

/**
 * Lightning tools (NWC). Thin wrappers over lib/lightning so the same logic is
 * usable by the agent (API-key mode) AND directly from workflows/scripts.
 * Mastra tool `execute` is positional: (inputData, ctx) — inputData is validated.
 */

export const getBalanceTool = createTool({
  id: 'lightning-get-balance',
  description: 'Obtener el balance actual de la wallet Lightning, en sats.',
  inputSchema: z.object({}),
  outputSchema: z.object({ balanceSats: z.number() }),
  execute: async () => ({ balanceSats: await getBalanceSats() }),
});

export const makeInvoiceTool = createTool({
  id: 'lightning-make-invoice',
  description: 'Crear una factura (invoice) BOLT11 Lightning por una cantidad en sats.',
  inputSchema: z.object({
    amountSats: z.number().int().positive().describe('Monto en sats'),
    description: z.string().optional().describe('Descripción de la factura'),
  }),
  outputSchema: z.object({
    bolt11: z.string(),
    paymentHash: z.string(),
    amountSats: z.number(),
  }),
  execute: async ({ amountSats, description }) =>
    makeInvoice(amountSats, description ?? ''),
});

export const payInvoiceTool = createTool({
  id: 'lightning-pay-invoice',
  description: 'Pagar una factura (invoice) BOLT11 Lightning. Devuelve el preimage.',
  inputSchema: z.object({
    bolt11: z.string().describe('Factura BOLT11 a pagar (empieza con lnbc...)'),
  }),
  outputSchema: z.object({
    preimage: z.string(),
    feesPaidSats: z.number(),
  }),
  execute: async ({ bolt11 }) => payInvoice(bolt11),
});
