import { NWCClient } from '@getalby/sdk/nwc';

/**
 * Lightning helpers over Nostr Wallet Connect (NIP-47), via @getalby/sdk v8.
 *
 * IMPORTANT: every amount in the NWC protocol is in **millisatoshis (msat)**.
 * These wrappers take/return **sats** and convert at the boundary so the rest
 * of the app never has to think about msat.
 *
 * Connect string comes from NWC_URL, e.g.:
 *   nostr+walletconnect://<pubkey>?relay=wss://...&secret=<hex>
 * Get one from your wallet (Alby Hub, Alby extension, Coinos, etc.).
 */

const MSATS_PER_SAT = 1000;

/** Build an NWC client from NWC_URL, or throw a clear Spanish error. */
export function getNwcClient(): NWCClient {
  const url = process.env.NWC_URL?.trim();
  if (!url) {
    throw new Error(
      'NWC_URL no está configurada. Pegá tu string de conexión Nostr Wallet Connect (nostr+walletconnect://...) en .env.',
    );
  }
  return new NWCClient({ nostrWalletConnectUrl: url });
}

/** Pay a BOLT11 invoice. Returns the preimage and fee paid (in sats). */
export async function payInvoice(
  bolt11: string,
): Promise<{ preimage: string; feesPaidSats: number }> {
  const client = getNwcClient();
  try {
    const res = await client.payInvoice({ invoice: bolt11.trim() });
    return {
      preimage: res.preimage,
      feesPaidSats: (res.fees_paid ?? 0) / MSATS_PER_SAT,
    };
  } finally {
    await client.close();
  }
}

/** Create a BOLT11 invoice for `amountSats`. Returns the invoice string + hash. */
export async function makeInvoice(
  amountSats: number,
  description = '',
): Promise<{ bolt11: string; paymentHash: string; amountSats: number }> {
  const client = getNwcClient();
  try {
    const tx = await client.makeInvoice({
      amount: amountSats * MSATS_PER_SAT, // NWC wants msat
      description,
    });
    return {
      bolt11: tx.invoice, // field is `invoice`, not `payment_request`
      paymentHash: tx.payment_hash,
      amountSats: tx.amount / MSATS_PER_SAT,
    };
  } finally {
    await client.close();
  }
}

/** Current wallet balance, in sats. */
export async function getBalanceSats(): Promise<number> {
  const client = getNwcClient();
  try {
    const { balance } = await client.getBalance(); // msat
    return balance / MSATS_PER_SAT;
  } finally {
    await client.close();
  }
}
