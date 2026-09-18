import { NextResponse } from "next/server";
import { buildBbiInsights, buildUseCaseRecommendations } from "@/lib/bbi";
import { getBlockchainSnapshot } from "@/lib/blockchainSnapshot";
import { ACTIVITY_METRICS, BBI_VERSION } from "@/lib/bbiMethodology";

// BBIM: cruza la base curada de redes con el TVL en vivo y calcula el índice.
// Capa 2 (actividad económica) siempre de DeFiLlama; capas 1, 3 y 4 curadas.
export async function GET() {
  const { chains, stablecoins, activity, weights, asOf, networks: scored } = await getBlockchainSnapshot();

  return NextResponse.json({
    source: chains.ok
      ? { ok: true, source: chains.source, fetchedAt: chains.fetchedAt, stale: chains.stale }
      : { ok: false, source: chains.source },
    asOf,
    weights,
    networks: scored,
    insights: buildBbiInsights(scored),
    recommendations: buildUseCaseRecommendations(scored),
    methodology: {
      version: BBI_VERSION,
      metrics: ACTIVITY_METRICS,
      activity:
        "Índice de actividad: direcciones activas 30%, oferta de stablecoins 25%, TVL 20%, volumen DEX 15% y comisiones 10%. Escalas logarítmicas fijas, separadas por indicador. Stocks y flujos no se suman.",
      editorial: "Las otras seis categorías son evaluación editorial de Blockfinity con fecha de corte.",
    },
    stablecoinSource: stablecoins.ok
      ? { ok: true, source: stablecoins.source, fetchedAt: stablecoins.fetchedAt, stale: stablecoins.stale }
      : { ok: false, source: stablecoins.source },
    activity,
  });
}
