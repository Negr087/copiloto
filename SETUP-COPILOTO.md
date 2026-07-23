# Copiloto

> Tu portapapeles no habla Bitcoin. Copiloto si.

Un agente que corre en tu Ubuntu y convierte `Ctrl+C` en la interfaz.
Copias una factura Lightning y te ofrece pagarla. Copias un npub y te dice
quien es. Copias cualquier otra cosa y haces `Ctrl+C` de nuevo: el agente
decide que hacer con eso.

Hackaton #5 AI AGENTS - La Crypta - track Bots & Automation.

---

## 1. Instalacion

```bash
git clone https://github.com/agustinkassis/ai-start copiloto
cd copiloto
nvm use            # Node 22+ obligatorio (lo pide @getalby/sdk)
pnpm install
```

Copia `daemon/`, `test/` y los archivos de `app/` de este paquete dentro del
repo, respetando la estructura.

### Dependencias del sistema

**Si estas en WSL (Ubuntu de consola sobre Windows): no necesitas instalar nada.**
El daemon detecta WSL solo y usa el portapapeles real de Windows a traves de
`powershell.exe`. Comprobalo:

```bash
powershell.exe -NoProfile -Command Get-Clipboard   # tiene que imprimir lo que copiaste
echo hola | clip.exe                               # y esto tiene que poder pegarse en Windows
```

Si estas en Ubuntu nativo:

```bash
# Wayland (default en Ubuntu 22.04+)
sudo apt install wl-clipboard libnotify-bin

# X11
sudo apt install xclip libnotify-bin

# Fallback de confirmacion
sudo apt install zenity
```

Verifica cual usas: `echo $XDG_SESSION_TYPE`

### Dependencias del proyecto

```bash
pnpm add light-bolt11-decoder dotenv
# @getalby/sdk, nostr-tools, ai y ai-sdk-provider-claude-code
# ya vienen en el boilerplate
```

Scripts en `package.json`:

```json
{
  "scripts": {
    "daemon": "tsx daemon/index.ts",
    "ask": "tsx daemon/ask.ts",
    "verificar": "tsx test/verificar.mts"
  }
}
```

---

## 2. Configuracion

En `.env`:

```bash
# Modelo. "subscription" usa tu Claude Pro: costo cero.
AI_PROVIDER=subscription

# Wallet NWC. Usa una dedicada con poco saldo.
NWC_URL=nostr+walletconnect://...

# Politica de pagos
CLIP_AUTOPAY_SATS=1000      # menos de esto se paga solo
CLIP_MAX_PAY_SATS=50000     # tope duro: nunca paga mas, ni confirmando

NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol
```

Antes de arrancar corre `pnpm setup` una vez para conectar tu suscripcion de
Claude (guarda `CLAUDE_CODE_OAUTH_TOKEN` en `.env`).

> **Usa una wallet dedicada con poco saldo.** Es un daemon que paga solo por
> debajo de cierto monto. No lo conectes a tu wallet principal.

---

## 3. Correr

```bash
pnpm verificar   # 42 chequeos, sin red y sin gastar tokens
pnpm daemon      # el agente
pnpm dev         # el feed en http://localhost:3000/feed
```

**En WSL, tene el feed abierto siempre**: ahi aparecen las confirmaciones de
pago. Es la misma pantalla que vas a proyectar en la demo.

**Kill switch:** `touch .data/paused`. Para reactivar, `rm .data/paused`.

### El atajo de teclado

En WSL y en Wayland el doble `Ctrl+C` funciona solo. En X11 (y como respaldo
en cualquier sesion) ata un atajo:

*Configuracion > Teclado > Atajos personalizados*

| | |
|---|---|
| Nombre | Preguntarle al agente |
| Comando | `bash -lc "cd /ruta/al/repo && pnpm ask"` |
| Atajo | `Super+A` |

---

## 4. Los tres caminos

El sistema tiene tres modos, y la diferencia entre ellos **es** la
arquitectura de privacidad:

| Camino | Se dispara | Toca la red | LLM |
|---|---|---|---|
| Factura Lightning | solo, al copiar | tu wallet NWC | no |
| npub / Nostr | solo, al copiar | relays | no |
| Agente | doble `Ctrl+C` o `Super+A` | tu proveedor de IA | si |

Las confirmaciones de pago aparecen en `/feed` con botones (en WSL siempre;
en Linux nativo se usa `notify-send` y el feed queda de respaldo).

Los dos primeros son deterministas: decodificar un BOLT11 y consultar relays
no necesita un modelo. Son instantaneos, gratis y no fallan.

El tercero es el agente de verdad, y **nunca se dispara solo**. Nada llega a
un LLM salvo que lo pidas explicitamente dos veces.

---

## 5. Como esta armado

```
daemon/
  index.ts          loop principal + integracion del doble copiado
  clipboard.ts      abstraccion WSL/Wayland/X11 + deteccion de secretos
  winClipboard.ts   puente a Windows via powershell.exe (WSL)
  copyEvents.ts     eventos de copiado en Wayland
  pending.ts        confirmaciones a traves del feed web
  router.ts         clasificador regex, cero LLM
  notify.ts         notify-send con botones, fallback a zenity
  nwc.ts            wallet Lightning via NWC
  nostrClient.ts    consultas a relays
  feed.ts           log JSONL para la UI
  ask.ts            entrada one-shot para el atajo de teclado
  agent/
    model.ts        resuelve el proveedor (subscription / anthropic / ...)
    intents.ts      catalogo de intenciones
    json.ts         parseo defensivo de la respuesta del clasificador
    pipeline.ts     clasificar -> actuar
  handlers/
    invoice.ts      decodifica BOLT11, confirma, paga
    npub.ts         perfil Nostr -> resumen al portapapeles
    ask.ts          fallback agentico
app/
  feed/page.tsx        la pantalla que proyectas en la demo
  api/feed/route.ts    lee el JSONL
  api/pending/route.ts confirmaciones de pago
test/
  verificar.mts     42 chequeos offline
```

### El pipeline del agente

Dos pasos, no uno:

1. **Clasificar** - el modelo mira el texto y elige una intencion del
   catalogo (`traducir`, `error`, `resumir`, `reescribir`, `explicar`,
   `responder`). Temperatura 0, solo los primeros 1200 caracteres.
2. **Actuar** - segunda llamada, ya con el system prompt especifico de esa
   intencion.

Esto es lo que lo hace un agente y no un wrapper: **nadie le dijo que hacer
con ese contenido, lo decide el.** Agregar una capacidad nueva es agregar
una entrada en `agent/intents.ts`; el clasificador la toma sola.

Va sin tools a proposito, para que funcione identico con el proveedor de
suscripcion (que no puentea las tools del AI SDK) y te salga cero pesos.

### Las tres barreras de privacidad

Un proceso que lee todo lo que copias tambien lee tus contrasenas. El jurado
te lo va a preguntar. Esta resuelto en el diseno, no parchado:

1. **Deteccion de secretos.** Los gestores de contrasenas marcan el
   portapapeles con MIME types tipo `x-kde-passwordManagerHint`. Si aparece
   alguno, ni leemos el contenido.
2. **Router de lista blanca.** Solo se procesa automaticamente lo que matchea
   una regla conocida. El resto se descarta en silencio: no se loguea, no se
   guarda, no sale de la maquina.
3. **El LLM es opt-in.** El agente exige un gesto explicito. Un `Ctrl+C`
   normal nunca manda nada a ningun lado.

Mostralo en vivo. Convertir la objecion obvia en un punto a favor suma mas
que una feature extra.

### Como funciona en WSL

WSL no tiene portapapeles propio ni demonio de notificaciones, pero si tiene
interop con Windows. El daemon lo aprovecha:

- **Lectura y escritura** via `powershell.exe` / `Set-Clipboard`, con el texto
  viajando en base64 para no pelear con el escapado entre bash y PowerShell.
- **Deteccion de copiado** con `GetClipboardSequenceNumber()`, un contador de
  Windows que sube en cada `Ctrl+C` aunque copies lo mismo dos veces. Para el
  doble copiado es mas confiable que el equivalente de Wayland: no inferimos
  el evento, lo leemos.
- **Un solo proceso PowerShell** de larga vida. Spawnearlo en cada poll
  costaria ~300ms y CPU constante.
- **Deteccion de secretos** por formatos de portapapeles de Windows
  (`ExcludeClipboardContentFromMonitorProcessing` y compania), que es como los
  gestores de contrasenas marcan lo que copian en esa plataforma.
- **Confirmaciones en el feed web**, con botones y cuenta regresiva.

---

## 6. Plan de 48 horas

**Viernes noche (4h)** - daemon + router + handler de facturas andando.
Al terminar la noche tenes que poder copiar una factura y pagarla. Si esto
no funciona el sabado a la manana, el proyecto esta en riesgo.

**Sabado manana (4h)** - handler de Nostr y el feed web.

**Sabado tarde (4h)** - el agente: `pnpm ask` primero (confiable), despues
el doble copiado. Probar las 6 intenciones con contenido real.

**Sabado noche (3h)** - las barreras de privacidad y el kill switch.
Probar con KeePassXC y Bitwarden de verdad.

**Domingo manana (3h)** - pulir el feed, que es lo que se proyecta.
Grabar un video de respaldo por si la wifi del evento falla.

**Domingo mediodia (2h)** - ensayar cinco veces cronometrado. Prepara las
facturas, los npubs y los textos de prueba en un archivo, listos para copiar.

**Deja de programar 3 horas antes de presentar.** Sin excepciones.

---

## 7. El guion de la demo (3 minutos)

Proyectas el feed en pantalla completa. No tocas el teclado mas que para
copiar.

1. **(20s) El problema.** "Copio una factura Lightning. Mi computadora ve
   basura. Tengo que abrir la wallet, pegar, revisar, confirmar. Cada vez."
2. **(25s) npub.** Copias el npub de alguien del publico. Aparece el perfil.
   "El sistema operativo no sabe que es esto. Mi agente si."
3. **(30s) Factura chica.** Copias una de 21 sats. Se paga sola. "Debajo de
   mil sats confia en mi politica."
4. **(30s) Factura grande.** Copias una de 10.000. En la misma pantalla
   aparece la confirmacion con monto, concepto y cuenta regresiva. Apretas
   Pagar. Pagada.
5. **(45s) El agente.** Copias un stacktrace. No pasa nada. **Lo copias de
   nuevo** y aparece el diagnostico. Despues copias dos veces un parrafo en
   ingles y vuelve traducido. "Nadie le dijo que hacer con esto. Lo decidio."
6. **(20s) Privacidad.** Copias una contrasena del gestor. El feed no
   registra nada. "Lo que no entiende, no lo mira. Y al LLM no llega nada
   salvo que se lo pida dos veces."
7. **(10s) Cierre.** "Cero prompts, cero apps abiertas. Tu portapapeles no
   habla Bitcoin. Copiloto si."

Cerra pagandole 21 sats en vivo a alguien del publico.

---

## 8. Lo que va a preguntar el jurado

**"Esto lee todo lo que copio."** - Las tres barreras. Mostralas.

**"Donde esta el agente? Esto es regex."** - El regex es la capa rapida y
gratis para lo que se puede resolver con certeza. El agente entra donde no
hay certeza: clasifica intencion y elige como actuar sobre contenido que
nadie anticipo. Las dos capas juntas son el punto, no un compromiso.

**"Que pasa si me copian una factura maliciosa?"** - Tope duro, limite de
auto-pago y confirmacion obligatoria arriba de ese limite. Decodificamos
localmente: ves monto y concepto antes de decidir.

**"Por que no una extension del navegador?"** - Porque el portapapeles es
del sistema operativo. Funciona desde la terminal, desde Telegram, desde un
PDF. No hay navegador de por medio.

---

## 9. Costo real

| Item | Costo |
|---|---|
| Hosting | $0 - corre en tu maquina |
| LLM | $0 - `AI_PROVIDER=subscription` con Claude Pro |
| Nostr y relays | $0 |
| Sats para probar | ~$13, casi todo recuperable pagandote entre wallets propias |

Los handlers de Lightning y Nostr no llaman al modelo, asi que el uso real de
IA es solo el que vos disparas a mano.

---

## 10. Despues de la hackaton

- Lightning Address (`user@dominio.com`) ademas de BOLT11
- Copiar un `nevent` y que resuma el hilo completo
- YouTube: copiar un link y recibir clips con subtitulos
- Historial buscable de lo que paso por el portapapeles
- Empaquetarlo como `.deb`

MIT.
