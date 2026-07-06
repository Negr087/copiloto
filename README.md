# AI Agents Starter · La Crypta

Boilerplate para el hackathon **AI AGENTS** de [La Crypta](https://lacrypta.dev) — track **Bots & Automation**. Arrancá a construir agentes autónomos, automatizaciones y workflows que combinan **LLMs** con **Bitcoin/Lightning (NWC)** y **Nostr**, sin pelear con la configuración.

- 🤖 Chat con un agente por streaming (Vercel AI SDK `useChat`)
- ⚡ Herramientas Lightning por **Nostr Wallet Connect** (NIP-47)
- 🟣 Herramientas **Nostr** (publicar/leer notas)
- 🔁 Workflow durable **pay-and-post**: el LLM redacta → paga una factura → publica la prueba en Nostr
- 🆓 Desarrollá gratis con tu suscripción de **Claude Pro/Max**, o usá **Anthropic / OpenAI / Vercel AI Gateway** — elegís proveedor y modelo desde `/setup`

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + Tailwind 4 |
| Agentes / workflows | [Mastra](https://mastra.ai) `@mastra/core` |
| LLM | [Vercel AI SDK **v6**](https://ai-sdk.dev) — Claude (Opus 4.8 por defecto) |
| Proveedores | Claude Code (suscripción) · Anthropic · OpenAI · [Vercel AI Gateway](https://vercel.com/ai-gateway) |
| Lightning | [`@getalby/sdk`](https://github.com/getAlby/js-sdk) (NWC / NIP-47) |
| Nostr | [`nostr-tools`](https://github.com/nbd-wtf/nostr-tools) |

## Requisitos

- **Node.js 22.13+** (Mastra lo requiere). Con nvm: `nvm use` (hay un `.nvmrc`).
- **pnpm** (el repo fija `pnpm@11` vía `packageManager` + corepack).
- Un proveedor de IA (elegís en `/setup`): Claude Code (gratis con Pro/Max), o una API key de Anthropic / OpenAI / Vercel AI Gateway.
- Para el proveedor **Claude Code**: el [CLI de Claude Code](https://claude.com/claude-code) instalado. `pnpm setup` te conecta.

## Quickstart (5 minutos)

```bash
# 1. Node 22
nvm install 22 && nvm use          # usa el .nvmrc del repo

# 2. Instalar dependencias
pnpm install

# 3. Conectar tu acceso a Claude (una sola vez)
pnpm setup                         # abre el navegador, guarda el token en .env

# 4. Levantar el dev server
pnpm dev                           # http://localhost:3000
```

`pnpm setup` corre el comando oficial `claude setup-token`: aprobás en el navegador
y se guarda un token de larga duración (`CLAUDE_CODE_OAUTH_TOKEN`) en `.env`. También
podés hacerlo desde la web en **[/setup](http://localhost:3000/setup)** (botón
"Conectar con Claude", o pegando un token / API key). Para publicar en Nostr, generá
una clave descartable con `pnpm gen:keys` y pegala en `.env`.

## Elegir proveedor y modelo

Todo se maneja desde la página **/setup** (solo en desarrollo) o `pnpm setup`. Elegís
**proveedor**, **modelo** y pegás la credencial; se guarda en `.env` y podés cambiarlo
cuando quieras. También hay un botón **"Probar conexión"** que hace una llamada mínima
al modelo para confirmar.

| Proveedor | `AI_PROVIDER` | Credencial | Notas |
| --- | --- | --- | --- |
| Claude (suscripción) | `subscription` | `CLAUDE_CODE_OAUTH_TOKEN` (de `claude setup-token`) | Gratis con Pro/Max. Solo Node.js. Sin tools en el chat. |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` | Pago por tokens. Cualquier runtime. |
| OpenAI | `openai` | `OPENAI_API_KEY` | Pago por tokens. Cualquier runtime. |
| Vercel AI Gateway | `gateway` | `AI_GATEWAY_API_KEY` | **Una key, cualquier modelo** (`proveedor/modelo`, ej. `openai/gpt-4o`). |

El proveedor por defecto es **Claude (suscripción)** — gratis. Todo se resuelve en
[`lib/model.ts`](lib/model.ts) leyendo `AI_PROVIDER` + `MODEL_ID` (dinámico, sin reiniciar).

> Para el proveedor de suscripción usamos el comando **oficial** `claude setup-token`,
> no un flujo OAuth casero. Los tokens de suscripción sacados por fuera del CLI oficial
> van contra los términos de Anthropic y pueden derivar en un baneo — esto lo evita.

> ⚠️ **Tools del chat.** El proveedor de suscripción (Claude Code) corre sus tools
> propias y **no** puentea las de Mastra/AI SDK — por eso el agente del chat tiene tools
> con Anthropic / OpenAI / Gateway, pero no con la suscripción. El workflow `pay-and-post`
> funciona con cualquier proveedor (llama a las funciones directo).

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
| `pnpm setup` | conecta tu suscripción de Claude (`claude setup-token`) y guarda el token en `.env` |
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
  setup/                 página /setup (elegir proveedor / modelo / credencial)
  api/setup/*            rutas dev-only: status, config, test, claude-login
lib/
  providers.ts           registry de proveedores (subscription/anthropic/openai/gateway)
  model.ts               resuelve el modelo según AI_PROVIDER + MODEL_ID (dinámico)
  claudeToken.ts         corre `claude setup-token` y captura el token
  envFile.ts             escribe config/credenciales en .env
  lightning.ts           NWC: pagar / crear factura / balance
  nostr.ts               publicar / leer notas
src/mastra/
  index.ts               instancia de Mastra (la lee `mastra dev`)
  agents/assistant.ts     agente del chat
  tools/lightning.ts      tools Lightning (wrappers de lib/lightning)
  tools/nostr.ts          tools Nostr (wrappers de lib/nostr)
  workflows/pay-and-post.ts   workflow LLM → pagar → publicar
scripts/
  setup-auth.ts          `pnpm setup`: conecta la suscripción de Claude
  gen-keys.mjs           generador de claves Nostr
  demo.ts                demo del camino Nostr
```

## Variables de entorno

Ver [`.env.example`](.env.example). Resumen:

Normalmente no las tocás a mano — `pnpm setup` / la página `/setup` las escriben.

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `AI_PROVIDER` | no | `subscription` \| `anthropic` \| `openai` \| `gateway`. Default `subscription`. |
| `MODEL_ID` | no | Modelo (vacío = default del proveedor). Para gateway: `proveedor/modelo`. |
| `CLAUDE_CODE_OAUTH_TOKEN` | proveedor subscription | Token de `claude setup-token`. |
| `ANTHROPIC_API_KEY` | proveedor anthropic | API key de Anthropic. |
| `OPENAI_API_KEY` | proveedor openai | API key de OpenAI. |
| `AI_GATEWAY_API_KEY` | proveedor gateway | Key de Vercel AI Gateway. |
| `NWC_URL` | para Lightning | String de conexión Nostr Wallet Connect (`nostr+walletconnect://...`). |
| `NOSTR_NSEC` | para publicar | Clave descartable para firmar notas (`pnpm gen:keys`). |
| `NOSTR_RELAYS` | no | Relays separados por coma. Default: `relay.damus.io`, `nos.lol`. |

## Deploy (Vercel)

El proveedor **subscription no sirve en serverless** (spawnea un subproceso del CLI).
Para deployar, usá `anthropic`, `openai` o `gateway`:

1. Configurá `AI_PROVIDER`, `MODEL_ID` y la key del proveedor (más `NWC_URL`, `NOSTR_NSEC`, `NOSTR_RELAYS` si las usás) en las env vars del proyecto.
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
