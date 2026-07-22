# Copiloto

> Tu portapapeles no habla Bitcoin. Copiloto sí.

Un daemon que corre en tu máquina y convierte `Ctrl+C` en una interfaz. Copiás
una factura Lightning y te ofrece pagarla. Copiás un `npub` y te dice quién
es. Copiás un LNURL y te resume qué es. Copiás una dirección Bitcoin y te
dice el saldo. Copiás cualquier otra cosa dos veces y un agente decide qué
hacer con eso.

## Los cinco caminos

| Copiás | Copiloto | Toca la red | LLM |
| --- | --- | --- | --- |
| Factura Lightning (BOLT11) | La paga (con tope de auto-pago y tope duro) o pide confirmación | tu wallet (NWC) | no |
| `npub` / `nprofile` / `nevent` / `note` | Resume el perfil o el evento, lo deja en el portapapeles | relays Nostr | no |
| LNURL (`lnurl1...`) | Decodifica y resume qué tipo de pedido es (pay/withdraw/channel/login) | el endpoint del LNURL | no |
| Dirección Bitcoin on-chain | Clasifica el tipo y consulta el saldo | mempool.space | no |
| Cualquier otra cosa, copiada **dos veces** | Un agente clasifica la intención (traducir, explicar, resumir, reescribir, diagnosticar un error, responder) y actúa | tu proveedor de IA | sí |

Los primeros cuatro son deterministas: un router por regex, sin modelo de por
medio — instantáneo, gratis, y no falla. El agente es el único camino que
sale hacia un LLM, y **nunca se dispara solo**: necesita el gesto explícito
de copiar dos veces.

Si pagás una factura y tenés `NOSTR_NSEC` configurada, Copiloto también
publica sola una nota de prueba del pago (nota + preimage) en Nostr.

## Privacidad, por diseño

Un proceso que lee todo lo que copiás también lee tus contraseñas. Por eso:

1. **Detección de secretos.** Si el gestor de contraseñas marca el
   portapapeles como secreto (KDE, KeePassXC, hints de Windows), Copiloto ni
   lee el contenido.
2. **Router de lista blanca.** Solo se procesa automáticamente lo que
   matchea una regla conocida (factura, npub, LNURL, dirección). Todo lo
   demás se descarta en silencio: no se loguea, no se guarda, no sale de la
   máquina.
3. **El LLM es opt-in.** El agente exige copiar dos veces. Un `Ctrl+C`
   normal jamás manda nada a ningún lado.

## Requisitos

- **Node.js 22.13+** (lo pide Mastra). Con nvm: `nvm use` (hay `.nvmrc`).
- **pnpm** (el repo fija `pnpm@11` vía `packageManager` + corepack).
- Una wallet Lightning con **Nostr Wallet Connect** (NWC) — usá una
  dedicada, con poco saldo: esto paga solo por debajo de cierto monto.
- Acceso al portapapeles del sistema:
  - **WSL**: nada que instalar, usa el portapapeles de Windows vía
    `powershell.exe`.
  - **Wayland**: `sudo apt install wl-clipboard libnotify-bin`
  - **X11**: `sudo apt install xclip libnotify-bin`
  - Fallback de confirmación en Linux nativo: `sudo apt install zenity`
- Un proveedor de IA para el agente (elegís en `/setup`): Claude Code
  (gratis con tu suscripción Pro/Max), o una API key de Anthropic / OpenAI /
  Vercel AI Gateway.

## Quickstart

```bash
# 1. Node 22
nvm install 22 && nvm use

# 2. Instalar dependencias
pnpm install

# 3. Conectar tu proveedor de IA (una sola vez)
pnpm setup                         # o entrá a /setup con `pnpm dev`

# 4. Configurar tu wallet y política de pagos en .env
cp .env.example .env
# completá NWC_URL como mínimo

# 5. Verificar que todo esté bien (sin red, sin gastar nada)
pnpm verificar

# 6. Arrancar
pnpm daemon                        # el daemon, escuchando el portapapeles
pnpm dev                           # el feed en http://localhost:3000
```

En WSL, tené el feed abierto siempre: ahí aparecen las confirmaciones de
pago con botones y cuenta regresiva. En Linux nativo se usa `notify-send`
(o `zenity` de respaldo) y el feed queda como historial.

**Kill switch:** `touch .data/paused` para pausar. `rm .data/paused` para
reactivar.

### El atajo de teclado

En WSL y en Wayland, el doble `Ctrl+C` dispara el agente solo. En X11 (y
como respaldo en cualquier sesión), atá un atajo de teclado a `pnpm ask`:

*Configuración > Teclado > Atajos personalizados*

| | |
| --- | --- |
| Comando | `bash -lc "cd /ruta/al/repo && pnpm ask"` |
| Atajo | el que prefieras |

## Variables de entorno

Ver [`.env.example`](.env.example). `pnpm setup` / `/setup` escriben las de
IA por vos; el resto las completás a mano.

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `NWC_URL` | sí | Conexión Nostr Wallet Connect de tu wallet (`nostr+walletconnect://...`). |
| `CLIP_AUTOPAY_SATS` | no | Debajo de este monto paga sin preguntar. `0` = pregunta siempre. Default `1000`. |
| `CLIP_MAX_PAY_SATS` | no | Tope duro: nunca paga más, ni confirmando. Default `50000`. |
| `NOSTR_NSEC` | no | Clave descartable para publicar (`pnpm gen:keys`). Sin esto, no se publica prueba de pago. |
| `NOSTR_RELAYS` | no | Relays separados por coma. Default: `relay.damus.io`, `nos.lol`. |
| `CLIP_POLL_MS` | no | Frecuencia de polling en Linux nativo (ms). Default `400`. |
| `AI_PROVIDER` | no | `subscription` \| `anthropic` \| `openai` \| `gateway`. Default `subscription`. |
| `MODEL_ID` | no | Modelo del agente (vacío = default del proveedor). |
| `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` | según proveedor | Credencial del proveedor de IA elegido. |

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm daemon` | corre el daemon: escucha el portapapeles y dispara los cinco caminos |
| `pnpm ask` | entrada one-shot para atar a un atajo de teclado (fallback a doble copia) |
| `pnpm dev` | levanta el feed web (confirmaciones de pago, historial, en tiempo real) |
| `pnpm verificar` | batería de chequeos sin red y sin gastar tokens |
| `pnpm setup` | conecta tu proveedor de IA y guarda la credencial en `.env` |
| `pnpm gen:keys` | genera una clave Nostr descartable para publicar |

## Estructura

```
daemon/
  index.ts            loop principal: watch del portapapeles + dispatch
  router.ts            clasificador por regex (factura, nostr, lnurl, on-chain)
  clipboard.ts          abstracción WSL / Wayland / X11 + detección de secretos
  winClipboard.ts        puente a Windows vía powershell.exe (WSL)
  copyEvents.ts          eventos de copiado en Wayland
  pending.ts             confirmaciones de pago a través del feed web
  feed.ts                log JSONL que alimenta la UI
  notify.ts               notify-send con botones, fallback a zenity
  nwc.ts                  wallet Lightning vía NWC
  nostrClient.ts           consultas de perfil a relays
  handlers/
    invoice.ts            decodifica BOLT11, confirma, paga
    npub.ts                perfil Nostr -> resumen al portapapeles
    lnurl.ts               decodifica LNURL, resume el pedido
    onchain.ts             clasifica la dirección, consulta el saldo
    postProof.ts           tras un pago, publica prueba en Nostr (opcional)
    ask.ts                  fallback agéntico (doble copia)
  agent/
    pipeline.ts            clasificar intención -> actuar
    intents.ts              catálogo de intenciones
    model.ts                 resuelve el proveedor de IA
app/
  page.tsx              el feed: confirmaciones + historial, en tiempo real (SSE)
  api/feed/stream/       endpoint SSE que empuja el feed y las confirmaciones
  api/pending/            aprobar/cancelar un pago pendiente
  setup/                  página /setup: elegir proveedor y modelo de IA
lib/
  lightning.ts           NWC: pagar / balance
  nostr.ts                publicar / leer notas
  model.ts                 resuelve el modelo según AI_PROVIDER + MODEL_ID
test/
  verificar.ts            batería de chequeos offline
```

## Gotchas

- **Node 22.13+ obligatorio** (Mastra). Con Node 20 falla. `nvm use`.
- **AI SDK fijado en v6.** `ai-sdk-provider-claude-code` no tiene build para
  v7, así que `ai`, `@ai-sdk/react` y `@ai-sdk/anthropic` están pineados en
  la línea v6. No los subas a `@latest`.
- **`.env`, no `.env.local`.** Lo leen tanto Next.js como el daemon.
- **Usá una wallet dedicada.** El daemon paga solo por debajo de
  `CLIP_AUTOPAY_SATS`. No conectes tu wallet principal.

## Licencia

MIT — ver [LICENSE](LICENSE).
