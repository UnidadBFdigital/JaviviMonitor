import { FRESH, jsonCached } from "@/lib/httpCache";
import {
  getStablecoins,
  getSupplyByIssuer,
  getStablecoinsBySymbol,
  getSupplyHistory,
  getStablecoinTotal,
} from "@/lib/sources/stablecoins";
import { getNewsByCategory } from "@/lib/sources/news";

// Las cinco que importan para la tesis institucional, aunque RLUSD, PYUSD y
// FDUSD queden fuera del top 10 por circulante.
const FOCUS = ["USDT", "USDC", "RLUSD", "PYUSD", "FDUSD"];

export async function GET() {
  const [list, byIssuer, focus, history, total, pagos, banca, regulacion] = await Promise.all([
    getStablecoins(10),
    getSupplyByIssuer(180),
    getStablecoinsBySymbol(FOCUS),
    getSupplyHistory(365),
    getStablecoinTotal(),
    getNewsByCategory("Pagos", 6),
    getNewsByCategory("Banca", 6),
    getNewsByCategory("Regulación", 6),
  ]);
  return jsonCached({ list, byIssuer, focus, history, total, pagos, banca, regulacion }, FRESH.minutes30);
}
