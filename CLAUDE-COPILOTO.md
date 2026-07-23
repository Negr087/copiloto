# Copiloto — contexto del proyecto

Agente para la Hackatón #5 "AI AGENTS" de La Crypta (track Bots & Automation).
Convierte Ctrl+C en la interfaz: copiás una factura Lightning y la paga,
copiás un npub y te dice quién es, copiás dos veces cualquier otra cosa y un
agente decide qué hacer.

## Entorno
- WSL (Ubuntu de consola sobre Windows 11). NO hay portapapeles Linux ni
  notify-send: el daemon usa el portapapeles de Windows vía powershell.exe.
- Node 22 con nvm, pnpm 11 con corepack.
- Base: boilerplate agustinkassis/ai-start (Next.js 16 + AI SDK v6). Se sacó
  Mastra: el daemon no usa tool-calling ni workflows, solo `generateText`.
- AI_PROVIDER=subscription (Claude Pro). El proyecto tiene que costar $0.

## Arquitectura
- `daemon/index.ts` — loop principal. En WSL va por eventos, no por polling.
- `daemon/winClipboard.ts` — puente a Windows. Un proceso PowerShell de larga
  vida vigila GetClipboardSequenceNumber(); el texto viaja en base64 y el
  script se manda con -EncodedCommand.
- `daemon/router.ts` — clasificador regex, sin LLM.
- `daemon/handlers/` — invoice (BOLT11), npub (Nostr), ask (agente).
- `daemon/agent/pipeline.ts` — clasificar intención, después actuar.
- `daemon/pending.ts` + `app/api/pending` — confirmaciones por el feed web.
- `test/verificar.ts` — 42 chequeos offline. Correr con `pnpm verificar`.

## Invariantes que NO se rompen
1. El LLM es opt-in. Sólo se dispara con doble Ctrl+C o `pnpm ask`. Un Ctrl+C
   normal nunca manda nada afuera.
2. El router es lista blanca: lo que no matchea una regla se descarta en
   silencio, sin loguear ni guardar.
3. Los pagos fallan cerrado: si vence el timeout de confirmación, se cancela.
4. Hay tope duro de pago (CLIP_MAX_PAY_SATS) que ni confirmando se supera.
5. El test es .ts, no .mts: el repo es CommonJS y .mts rompe los imports.

## Estado
Funcionan: puente WSL, handler de Nostr, agente con doble copia, feed web.
Sin probar: TODO el camino Lightning.
