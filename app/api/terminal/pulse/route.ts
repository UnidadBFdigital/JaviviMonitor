import { NextResponse } from "next/server";
import { FRESH, jsonCached, withCache } from "@/lib/httpCache";
import { getFearGreed } from "@/lib/sources/feargreed";
import { getGlobalMarket } from "@/lib/sources/coingecko";
import { getStablecoins, getStablecoinTotal } from "@/lib/sources/stablecoins";
import { getDexOverview } from "@/lib/sources/defillama";

// Columna derecha del terminal: sentimiento, dominancia, stablecoins, DEX.
export async function GET() {
  const [fearGreed, global, stables, stableTotal, dex] = await Promise.all([
    getFearGreed(),
    getGlobalMarket(),
    getStablecoins(5),
    getStablecoinTotal(),
    getDexOverview(),
  ]);
  // `stables` es el top 5 por emisor (para la lista); `stableTotal` es el
  // total canónico del mercado. No son intercambiables.
  return jsonCached({ fearGreed, global, stables, stableTotal, dex }, FRESH.minutes10);
}
