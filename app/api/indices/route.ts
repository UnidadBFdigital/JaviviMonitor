import { NextResponse } from "next/server";
import {
  getStablecoins,
  getSupplyHistory,
  getStablecoinTotal,
} from "@/lib/sources/stablecoins";
import { getTvlHistory, getRwaProtocols, getAllChainsTvl, getDexOverview } from "@/lib/sources/defillama";
import { getFearGreed } from "@/lib/sources/feargreed";
import { getGlobalMarket } from "@/lib/sources/coingecko";
import { getQuotes } from "@/lib/sources/yahoo";
import { getBlockchainSnapshot } from "@/lib/blockchainSnapshot";
import { buildSectors, UNCLASSIFIED } from "@/lib/rwaSectors";
import { computeIndices, type IndexContext } from "@/lib/indices";
import tokenizationJson from "@/data/tokenization.json";

const ETFS = ["IBIT", "FBTC", "ARKB", "BITB", "GBTC", "ETHA"];

// Índices propietarios. Reúne todos los insumos y delega el cálculo al
// registro de lib/indices: la ruta no sabe nada de fórmulas.
export async function GET() {
  const [stables, stableHistory, stableTotal, tvlHistory, rwa, chains, dex, fng, global, etfs, blockchain] =
    await Promise.all([
      getStablecoins(10),
      getSupplyHistory(365),
      getStablecoinTotal(),
      getTvlHistory(90),
      getRwaProtocols(),
      getAllChainsTvl(),
      getDexOverview(),
      getFearGreed(),
      getGlobalMarket(),
      getQuotes(ETFS),
      getBlockchainSnapshot(),
    ]);

  // RWA agregado por sector, para poder aislar treasuries
  let rwaTotalUsd: number | null = null;
  let rwaTreasuriesUsd: number | null = null;
  let rwaProtocolCount: number | null = null;
  if (rwa.ok) {
    const { sectors, totalUsd } = buildSectors(
      rwa.data,
      tokenizationJson.sectorMap as Record<string, string[]>
    );
    rwaTotalUsd = totalUsd;
    rwaProtocolCount = rwa.data.length;
    rwaTreasuriesUsd =
      sectors.find((s) => s.name.startsWith("Treasuries") && s.name !== UNCLASSIFIED)?.tvlUsd ?? 0;
  }

  const networks = blockchain.networks;

  const ctx: IndexContext = {
    stableHistory: stableHistory.ok ? stableHistory.data : null,
    stables: stables.ok ? stables.data : null,
    stablecoinTotalUsd: stableTotal.ok ? stableTotal.data.totalUsd : null,
    tvlHistory: tvlHistory.ok ? tvlHistory.data : null,
    rwaTotalUsd,
    rwaProtocolCount,
    rwaTreasuriesUsd,
    fearGreed: fng.ok ? fng.data : null,
    global: global.ok ? global.data : null,
    chains: chains.ok ? chains.data : null,
    networks,
    etfs: etfs.ok ? etfs.data : null,
    dex: dex.ok ? dex.data : null,
  };

  return NextResponse.json({
    indices: computeIndices(ctx),
    fetchedAt: new Date().toISOString(),
    sources: ["DeFiLlama", "Alternative.me", "CoinGecko", "Yahoo Finance"],
  });
}
