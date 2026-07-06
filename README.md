# AI Agents Starter · La Crypta

Boilerplate para el hackathon **AI AGENTS** de [La Crypta](https://lacrypta.dev) — track **Bots & Automation**. Arrancá a construir agentes autónomos, automatizaciones y workflows que combinan **LLMs** con **Bitcoin/Lightning (NWC)** y **Nostr**, sin pelear con la configuración.

- 🤖 Chat con un agente por streaming (Vercel AI SDK `useChat`)
- ⚡ Herramientas Lightning por **Nostr Wallet Connect** (NIP-47)
- 🟣 Herramientas **Nostr** (publicar/leer notas)
- 🔁 Workflow durable **pay-and-post**: el LLM redacta → paga una factura → publica la prueba en Nostr
- 🆓 Desarrollá gratis con tu suscripción de **Claude Pro/Max**; deployá con una API key

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + Tailwind 4 |
| Agentes / workflows | [Mastra](https://mastra.ai) `@mastra/core` |
| LLM | [Vercel AI SDK **v6**](https://ai-sdk.dev) + Claude (Opus 4.8 por defecto) |
| Auth del modelo | `ai-sdk-provider-claude-code` (suscripción) · `@ai-sdk/anthropic` (API key) |
| Lightning | [`@getalby/sdk`](https://github.com/getAlby/js-sdk) (NWC / NIP-47) |
| Nostr | [`nostr-tools`](https://github.com/nbd-wtf/nostr-tools) |

## Requisitos

- **Node.js 22.13+** (Mastra lo requiere). Con nvm: `nvm use` (hay un `.nvmrc`).
- **pnpm** (el repo fija `pnpm@11` vía `packageManager` + corepack).
- Para el **modo suscripción** (por defecto): el [CLI de Claude Code](https://claude.com/claude-code) instalado y logueado (`claude auth login`).
- Para el **modo API key**: una `ANTHROPIC_API_KEY` de [console.anthropic.com](https://console.anthropic.com).

## Quickstart (5 minutos)

```bash
# 1. Node 22
nvm install 22 && nvm use          # usa el .nvmrc del repo

# 2. Instalar dependencias
pnpm install

# 3. Variables de entorno
cp .env.example .env               # lo leen tanto Next.js como `mastra dev`
pnpm gen:keys                      # genera un nsec descartable → pegalo en .env

# 4. Levantar el dev server
pnpm dev                           # http://localhost:3000
```

Sin `ANTHROPIC_API_KEY` en `.env` arranca en **modo suscripción**: las llamadas al modelo pasan por tu login local de Claude Code (Pro/Max), gratis. Si `claude auth login` ya está hecho y `claude -p "hola"` responde en tu terminal, el chat funciona.

## Los dos modos de autenticación

Todo se resuelve en [`lib/model.ts`](lib/model.ts) según **si existe `ANTHROPIC_API_KEY`**:

| | Modo suscripción (por defecto) | Modo API key |
| --- | --- | --- |
| Se activa cuando | **no** hay `ANTHROPIC_API_KEY` | hay `ANTHROPIC_API_KEY` |
| Cómo llama al modelo | CLI de Claude Code (tu login Pro/Max) | HTTP vía `@ai-sdk/anthropic` |
| Costo | gratis (usa tu suscripción) | pago por tokens |
| Runtime | **solo Node.js** (spawnea el CLI) — no sirve en edge/serverless | cualquiera (edge, serverless, CI) |
| Tools del chat | ⚠️ **no** (ver abajo) | ✅ sí |
| Ideal para | desarrollar local gratis | **deploy** y tool-calling |

> ⚠️ **Tools en el chat y modo suscripción.** El provider de Claude Code corre las tools *propias* de Claude Code y **no** puentea las tools de Mastra/AI SDK. Por eso el agente del chat solo tiene tools en **modo API key**. El **workflow `pay-and-post` funciona en los dos modos** porque llama a las funciones directamente (no depende del tool-calling del modelo). Es el mejor lugar para ver las herramientas Lightning + Nostr en acción sin API key.

Modelo por defecto: `claude-opus-4-8`. Cambialo con `MODEL_ID` (en modo suscripción también valen los nombres cortos `opus` / `sonnet` / `haiku` / `fable`).

## El workflow pay-and-post

El showcase del track, en [`src/mastra/workflows/pay-and-post.ts`](src/mastra/workflows/pay-and-post.ts):

1. **draft-note** — el LLM redacta una nota corta (funciona en ambos modos).
2. **pay-invoice** — paga una factura BOLT11 por NWC (necesita `NWC_URL`).
3. **publish-proof** — publica la nota + el preimage en Nostr (necesita `NOSTR_NSEC`).

Corré la playground de Mastra y ejecutalo desde la UI:

```bash
pnpm playground        # Mastra Studio en http://localhost:4111
```

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` | Next.js dev server (chat + API) |
| `pnpm build` / `pnpm start` | build y arranque de producción |
| `pnpm playground` | Mastra Studio (`mastra dev`) para probar agentes y workflows |
| `pnpm gen:keys` | genera una clave Nostr descartable para desarrollo |
| `pnpm demo` | prueba de humo del camino Nostr: publica una nota con una clave descartable |

## Estructura

```
app/
  page.tsx              landing + chat embebido
  components/Chat.tsx    UI del chat (useChat, AI SDK v6)
  api/chat/route.ts      route handler que streamea desde el agente Mastra
lib/
  model.ts               resuelve el modelo (suscripción vs API key)
  lightning.ts           NWC: pagar / crear factura / balance
  nostr.ts               publicar / leer notas
src/mastra/
  index.ts               instancia de Mastra (la lee `mastra dev`)
  agents/assistant.ts     agente del chat
  tools/lightning.ts      tools Lightning (wrappers de lib/lightning)
  tools/nostr.ts          tools Nostr (wrappers de lib/nostr)
  workflows/pay-and-post.ts   workflow LLM → pagar → publicar
scripts/
  gen-keys.mjs           generador de claves Nostr
  demo.ts                demo del camino Nostr
```

## Variables de entorno

Ver [`.env.example`](.env.example). Resumen:

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | no | Si está, activa el modo API key. Si no, modo suscripción. |
| `MODEL_ID` | no | Modelo a usar. Default `claude-opus-4-8`. |
| `NWC_URL` | para Lightning | String de conexión Nostr Wallet Connect (`nostr+walletconnect://...`). |
| `NOSTR_NSEC` | para publicar | Clave descartable para firmar notas (`pnpm gen:keys`). |
| `NOSTR_RELAYS` | no | Relays separados por coma. Default: `relay.damus.io`, `nos.lol`. |

## Deploy (Vercel)

El **modo suscripción no sirve en serverless** (spawnea un subproceso del CLI). Para deployar:

1. Configurá `ANTHROPIC_API_KEY` (y opcionalmente `MODEL_ID`, `NWC_URL`, `NOSTR_NSEC`, `NOSTR_RELAYS`) en las env vars del proyecto.
2. Deployá normalmente. `next.config.ts` ya marca los paquetes de servidor como `serverExternalPackages`.

## Gotchas

- **Node 22.13+ obligatorio** (Mastra). Con Node 20 el build/CLI fallan. `nvm use`.
- **AI SDK fijado en v6.** `ai-sdk-provider-claude-code` no tiene build para v7, así que `ai`, `@ai-sdk/react` y `@ai-sdk/anthropic` están pineados en la línea v6. No los subas a `@latest` (es v7) o el provider de suscripción rompe.
- **pnpm build scripts.** `esbuild` necesita correr su postinstall (habilitado en `pnpm-workspace.yaml`). Si pnpm te pregunta, aprobalo.
- **`.env` vs `.env.local`.** Usá `.env` para que lo lean tanto Next.js como `mastra dev`.

## Ideas para tu proyecto

- Un bot que escucha menciones en Nostr y responde/paga automáticamente.
- Un agente que cobra por sus respuestas creando facturas Lightning.
- Automatizaciones con schedules (cron) que publican reportes firmados.
- RAG sobre tu propia data para un agente experto.

La entrega del proyecto se hace desde el dashboard de [lacrypta.dev](https://lacrypta.dev), como siempre.

## Licencia

MIT — ver [LICENSE](LICENSE).
