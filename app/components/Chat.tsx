'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

/** Extract the plain text of a UI message from its parts (AI SDK v6 shape). */
function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
}

export function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const busy = status === 'submitted' || status === 'streaming';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput('');
  }

  return (
    <div className="flex flex-col h-[32rem] rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-muted text-sm">
            Preguntale algo al agente — por ejemplo, «¿cómo pago una factura Lightning con NWC?»
            o «dame ideas para un bot de automatización».
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === 'user' ? 'text-right' : 'text-left'}
          >
            <span
              className={
                'inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ' +
                (m.role === 'user'
                  ? 'bg-cyan/15 text-foreground'
                  : 'bg-surface-2 text-foreground')
              }
            >
              {messageText(m.parts) || (busy ? '…' : '')}
            </span>
          </div>
        ))}
        {busy && (
          <div className="text-left">
            <span className="inline-block rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
              pensando…
            </span>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí tu mensaje…"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-cyan/60"
        />
        <button
          type="submit"
          disabled={busy || input.trim() === ''}
          className="rounded-lg bg-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
