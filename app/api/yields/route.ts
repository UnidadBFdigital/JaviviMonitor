import { NextResponse, type NextRequest } from "next/server";
import {
  buildPulse,
  filterPools,
  paginate,
  parseYieldQuery,
  pickFeatured,
  sortPools,
  summarizeOperations,
} from "@/lib/yields";
import type { YieldsPayload } from "@/lib/yieldsPayload";
import { getYieldUniverse, SOURCE_URL } from "@/lib/sources/defillamaYields";

// Explorador de rendimientos DeFi. El universo (~8.000 pools) queda en la
// caché del servidor y al navegador viaja solo lo que se ve: la página de la
// tabla, las tarjetas destacadas y los rangos por tipo de operación.

export async function GET(request: NextRequest) {
  const query = parseYieldQuery(request.nextUrl.searchParams);
  const universe = await getYieldUniverse();
  if (!universe.ok) {
    const payload: YieldsPayload = { ok: false, source: universe.source, error: "DeFiLlama Yields no respondió" };
    return NextResponse.json(payload, { status: 502 });
  }

  const pools = universe.data.pools;

  // tarjetas y rangos: mismos filtros, todas las operaciones
  const scoped = filterPools(pools, query, { op: true });
  const filtered = query.op === "all" ? scoped : scoped.filter((p) => p.operation === query.op);

  const chainCounts = new Map<string, number>();
  for (const pool of filterPools(pools, query, { chain: true })) {
    chainCounts.set(pool.chain, (chainCounts.get(pool.chain) ?? 0) + 1);
  }

  const payload: YieldsPayload = {
    ok: true,
    query,
    ...paginate(sortPools(filtered, query.sort, query.dir), query.page, query.size),
    featured: pickFeatured(filtered, 6),
    operations: summarizeOperations(scoped),
    chains: [...chainCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 14),
    // referencias del mercado: mismas para cualquier filtro, con perfil conservador
    pulse: buildPulse(pools),
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
  return NextResponse.json(payload);
}
