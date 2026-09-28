import { FRESH, jsonCached } from "@/lib/httpCache";
import { getFanTokens } from "@/lib/sources/coingecko";
import { buildLeagues, buildFanInsights } from "@/lib/fanTokens";
import fanJson from "@/data/fan-tokens.json";

// Fan tokens como caso de tokenización de comunidades: tamaño, liquidez y
// reparto por competencia. La liga es clasificación propia (data/fan-tokens.json).
export async function GET() {
  const tokens = await getFanTokens(50);

  if (!tokens.ok) {
    return jsonCached({
      source: tokens,
      totalMarketCapUsd: 0,
      totalVolume24hUsd: 0,
      leagues: [],
      tokens: [],
      insights: [],
    }, FRESH.minutes30);
  }

  const { leagues, totalMarketCapUsd, totalVolume24hUsd } = buildLeagues(
    tokens.data,
    fanJson.leagueMap as Record<string, string[]>
  );

  return jsonCached({
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
  }, FRESH.minutes30);
}
