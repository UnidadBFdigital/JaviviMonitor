import { NextResponse } from "next/server";
import { getFanTokens } from "@/lib/sources/coingecko";
import { buildLeagues, buildFanInsights } from "@/lib/fanTokens";
import fanJson from "@/data/fan-tokens.json";

// Fan tokens como caso de tokenización de comunidades: tamaño, liquidez y
// reparto por competencia. La liga es clasificación propia (data/fan-tokens.json).
export async function GET() {
  const tokens = await getFanTokens(50);

  if (!tokens.ok) {
    return NextResponse.json({
      source: tokens,
      totalMarketCapUsd: 0,
      totalVolume24hUsd: 0,
      leagues: [],
      tokens: [],
      insights: [],
    });
  }

  const { leagues, totalMarketCapUsd, totalVolume24hUsd } = buildLeagues(
    tokens.data,
    fanJson.leagueMap as Record<string, string[]>
  );

  return NextResponse.json({
    source: {
      ok: true,
      source: tokens.source,
      fetchedAt: tokens.fetchedAt,
      stale: tokens.stale,
    },
    totalMarketCapUsd,
    totalVolume24hUsd,
    leagues,
    tokens: tokens.data,
    insights: buildFanInsights(leagues, tokens.data, totalMarketCapUsd, totalVolume24hUsd),
  });
}
