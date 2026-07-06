import { generateText } from 'ai';
import { getModel } from '@/lib/model';
import { setupDisabledResponse, setupEnabled } from '@/lib/setupAuth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Ground-truth auth check: make a tiny model call with the current credentials.
 * Returns { ok: true } if the model responds, or { ok: false, error } otherwise.
 */
export async function POST() {
  if (!setupEnabled()) return setupDisabledResponse();
  try {
    const { text } = await generateText({
      model: getModel(),
      prompt: 'Respondé exactamente con la palabra: ok',
    });
    return Response.json({ ok: true, sample: text.trim().slice(0, 60) });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message });
  }
}
