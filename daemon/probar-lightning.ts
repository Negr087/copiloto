import "dotenv/config";
import { getBalanceSats } from "./nwc";

/**
 * Smoke test mas barato antes de tocar un pago: solo confirma que NWC_URL
 * conecta y que la wallet responde. No mueve fondos.
 */
async function main() {
  if (!process.env.NWC_URL?.trim()) {
    console.error("Falta NWC_URL en .env");
    process.exit(1);
  }

  try {
    const balance = await getBalanceSats();
    console.log("Balance: " + balance.toLocaleString("es-AR") + " sats");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    console.error("No pude leer el balance: " + msg);
    process.exit(1);
  }
}

main();
