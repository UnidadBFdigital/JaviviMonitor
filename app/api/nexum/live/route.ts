import { FRESH, jsonCached } from "@/lib/httpCache";
import { getAllChainsTvl } from "@/lib/sources/defillama";
import { getRwaDashboardMetrics } from "@/lib/sources/defillamaRwa";
import { getStablecoinTotal } from "@/lib/sources/stablecoins";
import { getGlobalMarket } from "@/lib/sources/coingecko";
import { getFearGreed } from "@/lib/sources/feargreed";

// Contraste del snapshot didáctico contra la realidad. Devuelve, por id de
// métrica del currículo, el valor que las mismas fuentes del terminal
// reportan ahora. La capa educativa lo usa para el botón "Dato vivo": el
// alumno ve cuánto se movió el mercado desde la foto con la que estudia.
//
// Cada fuente se resuelve por separado: si una falla, las demás siguen
// respondiendo. Lo que no llega, simplemente no aparece en `values`.

export const revalidate = 0;

type LiveValue = { value: number; source: string; fetchedAt: string; stale: boolean };

export async function GET() {
  const [chains, rwa, stables, global, fng] = await Promise.all([
    getAllChainsTvl(),
    getRwaDashboardMetrics(),
    getStablecoinTotal(),
    getGlobalMarket(),
    getFearGreed(),
  ]);

  const values: Record<string, LiveValue> = {};
  const failed: string[] = [];

  if (chains.ok) {
    const meta = { source: chains.source, fetchedAt: chains.fetchedAt, stale: chains.stale };
    const total = chains.data.reduce((sum, c) => sum + c.tvlUsd, 0);
    const leader = chains.data.reduce((max, c) => (c.tvlUsd > max ? c.tvlUsd : max), 0);
    values["chn.tvl"] = { value: total, ...meta };
    values["dfi.tvl"] = { value: total, ...meta };
    if (total > 0) values["chn.leader"] = { value: (leader / total) * 100, ...meta };
    values["chn.count"] = { value: chains.data.filter((c) => c.tvlUsd >= 1e9).length, ...meta };
  } else {
    failed.push(chains.source);
  }

  if (rwa.ok) {
    const meta = { source: rwa.source, fetchedAt: rwa.fetchedAt, stale: rwa.stale };
    values["rwa.active"] = { value: rwa.data.activeMcapUsd, ...meta };
    values["rwa.onchain"] = { value: rwa.data.onchainMcapUsd, ...meta };
    values["rwa.defiTvl"] = { value: rwa.data.defiActiveTvlUsd, ...meta };
    if (rwa.data.issuerCount !== null) values["rwa.issuers"] = { value: rwa.data.issuerCount, ...meta };
  } else {
    failed.push(rwa.source);
  }

  if (stables.ok) {
    const meta = { source: stables.source, fetchedAt: stables.fetchedAt, stale: stables.stale };
    values["stb.total"] = { value: stables.data.totalUsd, ...meta };
    if (stables.data.dominancePct !== null) {
      values["stb.dominance"] = { value: stables.data.dominancePct, ...meta };
    }
    // el conteo de redes solo se publica cuando el desglose por cadena llegó
    if (stables.data.chainBreakdownAvailable) {
      values["stb.chains"] = {
        value: stables.data.byChain.filter((c) => c.circulatingUsd >= 1e8).length,
        ...meta,
      };
    }
  } else {
    failed.push(stables.source);
  }

  if (global.ok) {
    const meta = { source: global.source, fetchedAt: global.fetchedAt, stale: global.stale };
    values["mkt.totalCap"] = { value: global.data.totalMarketCapUsd, ...meta };
    values["mkt.btcDom"] = { value: global.data.btcDominancePct, ...meta };
    values["mkt.volume"] = { value: global.data.totalVolume24hUsd, ...meta };
  } else {
    failed.push(global.source);
  }

  if (fng.ok) {
    values["mkt.fng"] = {
      value: fng.data.value,
      source: fng.source,
      fetchedAt: fng.fetchedAt,
      stale: fng.stale,
    };
  } else {
    failed.push(fng.source);
  }

  return jsonCached({ values, failed, fetchedAt: new Date().toISOString() }, FRESH.minutes10);
}
