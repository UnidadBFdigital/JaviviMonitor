import { NextResponse } from "next/server";
import { FRESH, jsonCached, withCache } from "@/lib/httpCache";
import { getRwaProtocols } from "@/lib/sources/defillama";
import { getRwaDashboardMetrics } from "@/lib/sources/defillamaRwa";
import { getRwaMarketTokens } from "@/lib/sources/coingecko";
import { buildSectors, buildRwaInsights } from "@/lib/rwaSectors";
import tokenizationJson from "@/data/tokenization.json";

// Se mantienen separados dos universos que DeFiLlama también distingue:
// capitalización de activos del dashboard RWA y TVL de protocolos etiquetados
// RWA/RWA Lending. Solo el segundo se agrega con los sectores de Blockfinity.
export async function GET() {
  const [dashboard, protocols, marketTokens] = await Promise.all([
    getRwaDashboardMetrics(),
    getRwaProtocols(),
    getRwaMarketTokens(),
  ]);

  if (!protocols.ok) {
    return jsonCached(
      {
        source: protocols,
        dashboard,
        totalUsd: 0,
        sectors: [],
        protocols: [],
        insights: [],
        marketTokens,
      },
      FRESH.minutes30
    );
  }

  const { sectors, totalUsd } = buildSectors(
    protocols.data,
    tokenizationJson.sectorMap as Record<string, string[]>
  );

  return withCache(
    NextResponse.json({
      source: {
        ok: true,
        source: protocols.source,
        fetchedAt: protocols.fetchedAt,
        stale: protocols.stale,
      },
      dashboard,
      totalUsd,
      sectors,
      // la tabla del hub no necesita los 128: el resto es cola larga
      protocols: protocols.data.slice(0, 40),
      insights: buildRwaInsights(sectors, protocols.data, totalUsd),
      marketTokens,
    }),
    FRESH.minutes30
  );
}
