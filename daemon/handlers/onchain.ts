import { writeClipboard } from "../clipboard";
import { notify } from "../notify";
import * as feed from "../feed";

type TipoAddr = "legacy" | "p2sh" | "segwit" | "taproot";

function clasificar(addr: string): TipoAddr {
  if (addr.startsWith("bc1p")) return "taproot";
  if (addr.startsWith("bc1")) return "segwit";
  if (addr.startsWith("3")) return "p2sh";
  return "legacy";
}

const ETIQUETA_TIPO: Record<TipoAddr, string> = {
  legacy: "legacy (P2PKH)",
  p2sh: "P2SH",
  segwit: "segwit nativo",
  taproot: "taproot",
};

interface MempoolAddressInfo {
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
}

/**
 * Unica consulta de red nueva a un tercero (mempool.space, API publica y
 * sin key). Una direccion on-chain ya es publica en la blockchain, pero
 * igual sale de la maquina hacia ese servicio: por eso esto SOLO pasa si
 * el router matcheo la direccion explicitamente, nunca especulativo.
 */
export async function handleOnchain(addr: string): Promise<void> {
  const tipo = ETIQUETA_TIPO[clasificar(addr)];

  try {
    const res = await fetch("https://mempool.space/api/address/" + addr, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error("mempool.space respondio " + res.status);

    const info = (await res.json()) as MempoolAddressInfo;
    const balance = info.chain_stats.funded_txo_sum - info.chain_stats.spent_txo_sum;
    const txs = info.chain_stats.tx_count;

    const resumen =
      tipo +
      " - " +
      (balance / 1e8).toFixed(8) +
      " BTC (" +
      balance.toLocaleString("es-AR") +
      " sats) - " +
      txs +
      (txs === 1 ? " tx" : " txs");

    await writeClipboard(resumen);
    await notify("Direccion Bitcoin", resumen);

    feed.append({
      kind: "onchain",
      preview: feed.preview(addr),
      status: "ok",
      title: tipo,
      detail: resumen,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    await notify("No pude consultar la direccion", msg);
    feed.append({
      kind: "onchain",
      preview: feed.preview(addr),
      status: "error",
      title: "No pude consultar mempool.space",
      detail: tipo + " - " + msg,
    });
  }
}
