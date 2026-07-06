import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getSecretKeyFromEnv, publishNote, readFeed } from '@/lib/nostr';

/**
 * Nostr tools. Thin wrappers over lib/nostr. Publishing signs with the key in
 * NOSTR_NSEC (a throwaway dev key — generate one with `pnpm gen:keys`).
 */

export const publishNoteTool = createTool({
  id: 'nostr-publish-note',
  description: 'Publicar una nota (kind 1) en Nostr firmada con la clave del entorno.',
  inputSchema: z.object({
    content: z.string().min(1).describe('Texto de la nota a publicar'),
  }),
  outputSchema: z.object({
    eventId: z.string(),
    accepted: z.number().describe('Cantidad de relays que aceptaron la nota'),
  }),
  execute: async ({ content }) => {
    const sk = getSecretKeyFromEnv();
    const { event, accepted } = await publishNote(sk, content);
    return { eventId: event.id, accepted };
  },
});

export const readFeedTool = createTool({
  id: 'nostr-read-feed',
  description: 'Leer las notas (kind 1) más recientes de los relays configurados.',
  inputSchema: z.object({
    limit: z.number().int().positive().max(100).optional().describe('Máximo de notas'),
  }),
  outputSchema: z.object({
    notes: z.array(
      z.object({
        id: z.string(),
        pubkey: z.string(),
        content: z.string(),
        created_at: z.number(),
      }),
    ),
  }),
  execute: async ({ limit }) => {
    const events = await readFeed(limit ?? 20);
    return {
      notes: events.map((e) => ({
        id: e.id,
        pubkey: e.pubkey,
        content: e.content,
        created_at: e.created_at,
      })),
    };
  },
});
