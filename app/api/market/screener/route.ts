import { NextResponse, type NextRequest } from "next/server";
import { parseScreenerQuery, queryScreener, type ScreenerPayload } from "@/lib/marketScreener";
import { getMarketUniverse, searchCoinGecko } from "@/lib/sources/coingeckoScreener";

// Screener paginado en el servidor: el universo de ~1000 activos queda en la
// caché y al navegador solo viaja la página visible. `deep=1` busca además
// fuera del top en todo CoinGecko, únicamente cuando el usuario lo pide.
export async function GET(request: NextRequest) {
  const query = parseScreenerQuery(request.nextUrl.searchParams);
  const universe = await getMarketUniverse();
  if (!universe.ok) {
    const payload: ScreenerPayload = { ok: false, source: universe.source, error: "CoinGecko no devolvió el listado de mercado" };
    return NextResponse.json(payload, { status: 502 });
  }

  let coins = universe.data.coins;
  let deep: "off" | "ok" | "failed" = "off";
  let extra = 0;
  if (request.nextUrl.searchParams.get("deep") === "1" && query.q.length >= 2) {
    const found = await searchCoinGecko(query.q);
    if (found.ok) {
      const known = new Set(coins.map((c) => c.id));
      const added = found.data.filter((c) => !known.has(c.id));
      extra = added.length;
      coins = [...coins, ...added];
      deep = "ok";
    } else {
      deep = "failed";
    }
  }

  const payload: ScreenerPayload = {
    ok: true,
    ...queryScreener(coins, query),
    query,
    universe: universe.data.coins.length,
    pagesLoaded: universe.data.pagesLoaded,
    pagesRequested: universe.data.pagesRequested,
    deep,
    extra,
    source: universe.source,
    fetchedAt: universe.fetchedAt,
    stale: universe.stale,
  };
  return NextResponse.json(payload);
}
