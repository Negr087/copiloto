import { handleChatStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import { mastra } from '@/src/mastra';

// Node runtime is required: in subscription mode the Claude Code provider spawns
// the `claude` CLI as a subprocess, which can't run on the edge runtime.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const params = await req.json();

  // handleChatStream drives the Mastra agent and adapts its output to an
  // AI SDK v6 UI message stream that useChat understands.
  const stream = await handleChatStream({
    mastra,
    agentId: 'assistant',
    params,
    version: 'v6',
  });

  return createUIMessageStreamResponse({ stream });
}
