import {
  payInvoice as payInvoiceLib,
  getBalanceSats as getBalanceSatsLib,
} from "@/lib/lightning";

/**
 * Delega en lib/lightning.ts: ese wrapper ya está escrito contra la firma
 * real de @getalby/sdk v8 (NWCClient se importa de "@getalby/sdk/nwc"; no
 * existe un export "nwc" en la raíz del paquete, que era lo que asumía la
 * version anterior de este archivo y rompía en el primer require).
 */

export interface PayResult {
  preimage: string;
  feesPaid?: number;
}

export async function payInvoice(invoice: string): Promise<PayResult> {
  const res = await payInvoiceLib(invoice);
  return { preimage: res.preimage, feesPaid: res.feesPaidSats };
}

export async function getBalanceSats(): Promise<number> {
  return getBalanceSatsLib();
}

export function closeWallet() {
  // lib/lightning.ts abre y cierra su cliente NWC en cada llamada
  // (ver getNwcClient()); no queda una conexion persistente que cerrar aca.
}
