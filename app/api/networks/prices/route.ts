import { FRESH, jsonCached } from "@/lib/httpCache";
import { getNetworkPrices } from "@/lib/networks/prices";

// Precio del token de cada red, separado de /api/networks a propósito: pesa
// hasta 15 llamadas a CoinGecko en frío y solo lo necesita quien elige la
// métrica de precio en «Evolución de la red».
export async function GET() {
  return jsonCached(await getNetworkPrices(), FRESH.hour);
}
