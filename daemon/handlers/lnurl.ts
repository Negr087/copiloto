import { bech32 } from "@scure/base";
import { writeClipboard } from "../clipboard";
import { notify } from "../notify";
import * as feed from "../feed";

/** LUD-01 no fija un tope; 2000 words alcanza para cualquier URL razonable. */
const LNURL_BECH32_LIMIT = 2000;

function decodeLnurl(lnurl: string): string {
  const { words } = bech32.decode(lnurl as `${string}1${string}`, LNURL_BECH32_LIMIT);
  return new TextDecoder().decode(bech32.fromWords(words));
}

interface LnurlPay {
  tag: "payRequest";
  minSendable: number;
  maxSendable: number;
  metadata: string;
}

interface LnurlWithdraw {
  tag: "withdrawRequest";
  minWithdrawable: number;
  maxWithdrawable: number;
  defaultDescription?: string;
}

interface LnurlChannel {
  tag: "channelRequest";
}

interface LnurlAuth {
  tag: "login";
}

interface LnurlError {
  status: "ERROR";
  reason?: string;
  tag?: undefined;
}

type LnurlResponse = LnurlPay | LnurlWithdraw | LnurlChannel | LnurlAuth | LnurlError;

/**
 * Solo leemos y resumimos. Un withdraw o un login de LNURL mueven plata o
 * inician sesion en otro lado: eso requiere una decision explicita del
 * usuario, nunca la toma este handler por su cuenta.
 */
function resumenDe(data: LnurlResponse): { titulo: string; texto: string } {
  if ("status" in data && data.status === "ERROR") {
    return { titulo: "LNURL con error", texto: data.reason ?? "sin detalle" };
  }

  switch (data.tag) {
    case "payRequest": {
      const min = Math.floor(data.minSendable / 1000);
      const max = Math.floor(data.maxSendable / 1000);
      let desc = "";
      try {
        const meta = JSON.parse(data.metadata) as [string, string][];
        desc = meta.find((m) => m[0] === "text/plain")?.[1] ?? "";
      } catch {
        // metadata no parseable, seguimos sin descripcion
      }
      return {
        titulo: "LNURL-pay",
        texto:
          "Acepta entre " +
          min.toLocaleString("es-AR") +
          " y " +
          max.toLocaleString("es-AR") +
          " sats" +
          (desc ? "\n" + desc : ""),
      };
    }
    case "withdrawRequest": {
      const min = Math.floor(data.minWithdrawable / 1000);
      const max = Math.floor(data.maxWithdrawable / 1000);
      return {
        titulo: "LNURL-withdraw",
        texto:
          "Retiro disponible: " +
          min.toLocaleString("es-AR") +
          " a " +
          max.toLocaleString("es-AR") +
          " sats" +
          (data.defaultDescription ? "\n" + data.defaultDescription : "") +
          "\n\nNo lo ejecuto solo: un retiro necesita tu confirmacion explicita.",
      };
    }
    case "channelRequest":
      return {
        titulo: "LNURL-channel",
        texto: "Pide abrir un canal Lightning. No lo ejecuto automaticamente.",
      };
    case "login":
      return {
        titulo: "LNURL-auth",
        texto: "Es un pedido de login. No inicio sesion por vos: hacelo manualmente si confias en el sitio.",
      };
    default:
      return { titulo: "LNURL", texto: JSON.stringify(data).slice(0, 200) };
  }
}

export async function handleLnurl(lnurl: string): Promise<void> {
  try {
    const url = decodeLnurl(lnurl);
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(url + " respondio " + res.status);

    const data = (await res.json()) as LnurlResponse;
    const { titulo, texto } = resumenDe(data);

    await writeClipboard(titulo + "\n\n" + texto);
    await notify(titulo, texto);

    feed.append({
      kind: "lnurl",
      preview: feed.preview(lnurl),
      status: "ok",
      title: titulo,
      detail: texto,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    await notify("LNURL ilegible", msg);
    feed.append({
      kind: "lnurl",
      preview: feed.preview(lnurl),
      status: "error",
      title: "No pude leer el LNURL",
      detail: msg,
    });
  }
}
