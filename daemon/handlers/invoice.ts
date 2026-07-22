import { decode } from "light-bolt11-decoder";
import { CONFIG } from "../config";
import { confirm, notify } from "../notify";
import { payInvoice } from "../nwc";
import { publicarProbaDePago } from "./postProof";
import * as feed from "../feed";

export interface Decoded {
  sats: number | null;
  description: string;
  expired: boolean;
  expiresInMin: number;
}

/**
 * Decodificamos localmente, sin pedirle nada a la wallet.
 * Asi podemos mostrar monto y concepto antes de que el usuario decida.
 */
function decodeInvoice(invoice: string): Decoded {
  const parsed = decode(invoice) as {
    sections: Array<{ name: string; value?: unknown; letters?: string }>;
    expiry?: number;
  };

  const section = (name: string) =>
    parsed.sections.find((s) => s.name === name)?.value;

  const msats = section("amount");
  const timestamp = section("timestamp") as number | undefined;
  const expiry = (parsed.expiry ?? 3600) as number;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = (timestamp ?? now) + expiry;

  return {
    sats: msats ? Math.floor(Number(msats) / 1000) : null,
    description: String(section("description") ?? "sin concepto"),
    expired: now > expiresAt,
    expiresInMin: Math.max(0, Math.round((expiresAt - now) / 60)),
  };
}

/** Dependencias inyectables: en produccion son las reales (red, notificaciones). */
export interface InvoiceDeps {
  pagar: typeof payInvoice;
  confirmar: typeof confirm;
  avisar: typeof notify;
}

const depsReales: InvoiceDeps = { pagar: payInvoice, confirmar: confirm, avisar: notify };

/**
 * Logica de decision una vez decodificada la factura: separada de
 * handleInvoice para poder probar los invariantes de auto-pago/confirmacion/
 * tope duro con un `Decoded` armado a mano, sin depender de un BOLT11 real
 * firmado (light-bolt11-decoder no ofrece encoder) ni tocar la red.
 */
export async function procesarFactura(
  invoice: string,
  info: Decoded,
  deps: InvoiceDeps = depsReales,
): Promise<void> {
  if (info.expired) {
    await deps.avisar("Factura vencida", info.description);
    feed.append({
      kind: "invoice",
      preview: feed.preview(invoice),
      status: "error",
      title: "Factura vencida",
      detail: info.description,
    });
    return;
  }

  // Facturas sin monto (amountless) las tratamos como riesgosas: siempre preguntan.
  const sats = info.sats;
  const montoTxt = sats === null ? "monto abierto" : sats.toLocaleString("es-AR") + " sats";

  if (sats !== null && sats > CONFIG.maxPaySats) {
    await deps.avisar(
      "Factura bloqueada",
      montoTxt + " supera tu tope de " + CONFIG.maxPaySats.toLocaleString("es-AR") + " sats.",
    );
    feed.append({
      kind: "invoice",
      preview: feed.preview(invoice),
      status: "error",
      title: "Bloqueada por el tope de seguridad",
      detail: montoTxt,
    });
    return;
  }

  const autoPay =
    sats !== null && CONFIG.autoPayLimitSats > 0 && sats <= CONFIG.autoPayLimitSats;

  if (!autoPay) {
    const ok = await deps.confirmar(
      "Factura Lightning detectada",
      montoTxt + "\n" + info.description + "\nVence en " + info.expiresInMin + " min",
    );

    if (!ok) {
      feed.append({
        kind: "invoice",
        preview: feed.preview(invoice),
        status: "cancelled",
        title: "Pago cancelado",
        detail: montoTxt,
      });
      return;
    }
  }

  try {
    const res = await deps.pagar(invoice);
    const detalle = autoPay ? montoTxt + " (auto)" : montoTxt;

    await deps.avisar("Pagado " + montoTxt, info.description);
    feed.append({
      kind: "invoice",
      preview: feed.preview(invoice),
      status: "ok",
      title: autoPay ? "Pagada automaticamente" : "Pagada",
      detail: detalle + " - preimage " + res.preimage.slice(0, 12) + "...",
    });

    // Fire-and-forget: publicarProbaDePago nunca tira, y un pago ya
    // confirmado no debe esperar (ni depender de) la publicacion en Nostr.
    void publicarProbaDePago(info.description, res.preimage);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    await deps.avisar("Fallo el pago", msg);
    feed.append({
      kind: "invoice",
      preview: feed.preview(invoice),
      status: "error",
      title: "Fallo el pago",
      detail: msg,
    });
  }
}

export async function handleInvoice(
  invoice: string,
  deps: InvoiceDeps = depsReales,
): Promise<void> {
  let info: Decoded;

  try {
    info = decodeInvoice(invoice);
  } catch {
    await deps.avisar("Factura ilegible", "No pude decodificar ese BOLT11.");
    feed.append({
      kind: "invoice",
      preview: feed.preview(invoice),
      status: "error",
      title: "Factura ilegible",
    });
    return;
  }

  return procesarFactura(invoice, info, deps);
}
