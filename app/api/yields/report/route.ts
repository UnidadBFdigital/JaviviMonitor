import { NextResponse } from "next/server";
import { FRESH, jsonCached } from "@/lib/httpCache";
import {
  bestByOperation,
  buildPulse,
  filterPools,
  parseYieldQuery,
  summarizeMix,
  summarizeOperations,
  topByProject,
  type AssetFilter,
} from "@/lib/yields";
import type { YieldsReportPayload } from "@/lib/yieldsPayload";
import { getYieldUniverse, SOURCE_URL } from "@/lib/sources/defillamaYields";

// Capítulo de rendimientos del informe descargable. Una sola llamada con todo
// lo que el capítulo imprime, calculado sobre el mismo universo cacheado que
// usa el explorador: las cifras del PDF y las de la pantalla coinciden.

const ASSET_LABELS: { asset: AssetFilter; label: string }[] = [
  { asset: "usd", label: "Dólares (stablecoins)" },
  { asset: "eth", label: "ETH y derivados" },
  { asset: "btc", label: "BTC tokenizado" },
  { asset: "sol", label: "SOL y staking líquido" },
];

export async function GET() {
  const universe = await getYieldUniverse();
  if (!universe.ok) {
    const payload: YieldsReportPayload = { ok: false, source: universe.source, error: "DeFiLlama Yields no respondió" };
    return jsonCached(payload, FRESH.minutes30, { status: 502 });
  }

  const pools = universe.data.pools;
  const balanced = parseYieldQuery(new URLSearchParams());
  const scoped = filterPools(pools, balanced, { op: true });

  const payload: YieldsReportPayload = {
    ok: true,
    pulse: buildPulse(pools),
    operations: summarizeOperations(scoped),
    featured: bestByOperation(scoped),
    byAsset: ASSET_LABELS.map(({ asset, label }) => ({
      asset,
      label,
      pools: topByProject(filterPools(pools, { ...balanced, asset, risk: "conservative" }), 5),
    })),
    mix: { risk: summarizeMix(pools).risk, terms: summarizeMix(scoped).terms },
    universe: {
      pools: pools.length,
      tvlUsd: pools.reduce((sum, p) => sum + p.tvlUsd, 0),
      withoutYield: universe.data.withoutYield,
      published: universe.data.published,
      borrowRates: universe.data.borrowRates,
    },
    source: universe.source,
    sourceUrl: SOURCE_URL,
    fetchedAt: universe.fetchedAt,
    stale: universe.stale,
  };
  return jsonCached(payload, FRESH.minutes30);
}
