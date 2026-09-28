import { FRESH, jsonCached } from "@/lib/httpCache";
import {
  getAllChainsTvl,
  getDexOverview,
  getProtocolRevenue,
  getRwaProtocols,
  getTopProtocols,
  getTvlHistory,
} from "@/lib/sources/defillama";
import { getRwaDashboardMetrics } from "@/lib/sources/defillamaRwa";
import { getGlobalMarket } from "@/lib/sources/coingecko";
import { getFearGreed } from "@/lib/sources/feargreed";
import {
  getStablecoinSupplyByChain,
  getStablecoins,
  getStablecoinTotal,
  getSupplyHistory,
} from "@/lib/sources/stablecoins";
import { getBitcoinOnchainData, getNetworkActivity } from "@/lib/sources/coinmetrics";
import { getHacks } from "@/lib/sources/hacks";
import { getBlockchainSnapshot } from "@/lib/blockchainSnapshot";
import type { Weights } from "@/lib/bbi";
import { bucketBy, buildTimeline, longestStreak, monthsAgo, sortBuckets, weeklyCadence } from "@/lib/hackStats";
import { buildSectors, UNCLASSIFIED } from "@/lib/rwaSectors";
import blockchainsJson from "@/data/blockchains.json";
import cbdcJson from "@/data/cbdc-tracker.json";
import tokenizationJson from "@/data/tokenization.json";
import type { SourceResult } from "@/lib/sources/types";
import type { ReportPayload, ReportNetwork, ReportSource } from "@/lib/report";

// Insumo del Blockchain Landscape Report (BBIM §3 Fase 4). Arma en una sola
// llamada los bloques que el informe imprime, siguiendo el orden de capas
// del documento del proyecto: arquitectura, actividad económica, ecosistema
// y adopción institucional.
//
// Cada bloque viaja con su fuente y su timestamp — el informe es un PDF que
// va a circular fuera del terminal, así que la trazabilidad tiene que
// imprimirse dentro del documento, no quedarse en la pantalla.

function track(block: string, result: SourceResult<unknown>): ReportSource {
  return result.ok
    ? { block, source: result.source, fetchedAt: result.fetchedAt, ok: true, stale: result.stale }
    : { block, source: result.source, fetchedAt: null, ok: false, stale: false };
}

function changePct(series: { tvlUsd: number }[], back: number): number | null {
  if (series.length <= back) return null;
  const now = series[series.length - 1].tvlUsd;
  const then = series[series.length - 1 - back].tvlUsd;
  return then > 0 ? ((now - then) / then) * 100 : null;
}

/**
 * Reduce una serie a `max` puntos conservando SIEMPRE el primero y el último.
 * El informe se imprime: 120 puntos en 180pt de ancho son ruido, y un recorte
 * que pierda el cierre movería el último valor del gráfico respecto al de la
 * cifra que va al lado.
 */
function downsample<T>(series: T[], max: number): T[] {
  if (series.length <= max) return series;
  const step = (series.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(series[Math.round(i * step)]);
  return out;
}

const SECURITY_WINDOW_DAYS = 90;
const PROTOCOL_UNIVERSE = 80;

export async function GET() {
  const [
    global,
    fng,
    tvlHistory,
    chains,
    dex,
    protocols,
    revenue,
    rwaDashboard,
    rwa,
    stables,
    stableTotal,
    stableByChain,
    btc,
    activity,
    hacks,
    stableHistory,
    blockchain,
  ] = await Promise.all([
    getGlobalMarket(),
    getFearGreed(),
    getTvlHistory(31),
    getAllChainsTvl(),
    getDexOverview(),
    getTopProtocols(PROTOCOL_UNIVERSE),
    getProtocolRevenue(5),
    getRwaDashboardMetrics(),
    getRwaProtocols(),
    getStablecoins(6),
    getStablecoinTotal(),
    getStablecoinSupplyByChain(),
    getBitcoinOnchainData(120),
    getNetworkActivity(30),
    getHacks(),
    getSupplyHistory(90),
    getBlockchainSnapshot(),
  ]);

  // --- capa 1: landscape y concentración de infraestructura
  const chainTotal = chains.ok ? chains.data.reduce((sum, c) => sum + c.tvlUsd, 0) : 0;
  const rankedChains = chains.ok ? [...chains.data].sort((a, b) => b.tvlUsd - a.tvlUsd) : [];
  const chainRows = rankedChains.slice(0, 12).map((c) => ({
    name: c.name,
    tvlUsd: c.tvlUsd,
    sharePct: chainTotal > 0 ? (c.tvlUsd / chainTotal) * 100 : 0,
  }));

  // --- capa 1/2: scorecard BBI con los pesos del documento del proyecto
  const scored = blockchain.networks;
  const networks: ReportNetwork[] = [...scored]
    .map((n) => ({
      name: n.name,
      group: n.group,
      type: n.type,
      consensus: n.consensus,
      bbi: n.bbi,
      bbiPartial: n.bbiPartial,
      activityCoverage: n.activityCoverage,
      activeAddresses24h: n.activeAddresses24h,
      dexVolume24hUsd: n.dexVolume24hUsd,
      chainFees24hUsd: n.chainFees24hUsd,
      tvlUsd: n.tvlUsd,
      stablecoinSupplyUsd: n.stablecoinSupplyUsd,
      economicFootprintUsd: n.economicFootprintUsd,
      actividadEconomica: n.actividadEconomica,
      // el mapa de calor de la sección 02 dibuja las seis categorías
      // editoriales, no solo las tres que entraban en la tabla vieja
      scores: { ...n.scores },
      institutionalAdoption: n.institutionalAdoption,
      regulatoryRisk: n.regulatoryRisk,
      review: n.review,
      referenceMetrics: n.referenceMetrics,
    }));

  // --- capa 3: reparto del ecosistema por categoría de protocolo
  // Se agrega sobre el universo de los PROTOCOL_UNIVERSE protocolos más
  // grandes, no sobre DeFi entero: es la lectura honesta de "en qué está el
  // capital de los protocolos que mueven la aguja", y así se rotula.
  const categoryTotals = new Map<string, { tvlUsd: number; count: number }>();
  if (protocols.ok) {
    for (const p of protocols.data) {
      const entry = categoryTotals.get(p.category) ?? { tvlUsd: 0, count: 0 };
      entry.tvlUsd += p.tvlUsd;
      entry.count += 1;
      categoryTotals.set(p.category, entry);
    }
  }
  const categoryMix = [...categoryTotals.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, 7);

  // --- capa 4: tokenización por sector
  let topSectors: ReportPayload["tokenization"]["topSectors"] = [];
  let protocolTvlUsd: number | null = null;
  if (rwa.ok && rwa.data.length > 0) {
    const { sectors, totalUsd } = buildSectors(
      rwa.data,
      tokenizationJson.sectorMap as Record<string, string[]>
    );
    protocolTvlUsd = totalUsd;
    topSectors = sectors
      .filter((s) => s.name !== UNCLASSIFIED)
      .slice(0, 6)
      .map((s) => ({
        name: s.name,
        tvlUsd: s.tvlUsd,
        sharePct: s.sharePct,
        change7dPct: s.change7dPct,
      }));
  }

  // --- CBDC: recuento por estado sobre el tracker curado
  const jurisdictions = cbdcJson.jurisdictions as { jurisdiction: string; status: string }[];
  const statusMap = new Map<string, string[]>();
  for (const j of jurisdictions) {
    statusMap.set(j.status, [...(statusMap.get(j.status) ?? []), j.jurisdiction]);
  }
  const byStatus = [...statusMap.entries()]
    .map(([status, list]) => ({ status, count: list.length, jurisdictions: list }))
    .sort((a, b) => b.count - a.count);

  // --- seguridad: ventana de 90 días sobre el registro de incidentes
  let security: ReportPayload["security"] = null;
  if (hacks.ok) {
    const from = monthsAgo(3);
    const window = hacks.data.events.filter((e) => e.date >= from);
    const priced = window.filter((e) => e.amountUsd !== null);
    const cadence = weeklyCadence(window, 13, new Date().toISOString().slice(0, 10));
    // 24 meses del registro completo: el período de 90 días no se lee solo,
    // necesita la escala de lo que vino antes.
    const monthly = buildTimeline(hacks.data.events, "month").slice(-24);
    security = {
      windowDays: SECURITY_WINDOW_DAYS,
      from,
      count: window.length,
      amountUsd: priced.reduce((sum, e) => sum + (e.amountUsd ?? 0), 0),
      unpricedCount: window.length - priced.length,
      weeksWithIncident: cadence.filter((w) => w.count > 0).length,
      weeksObserved: cadence.length,
      longestStreak: longestStreak(cadence),
      cadence,
      monthly,
      topVectors: sortBuckets(bucketBy(window, (e) => [e.classification]), "count").slice(0, 5),
      topChains: sortBuckets(bucketBy(window, (e) => e.chains), "count").slice(0, 5),
      biggest: [...priced]
        .sort((a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0))
        .slice(0, 6)
        .map((e) => ({
          date: e.date,
          name: e.name,
          amountUsd: e.amountUsd,
          chains: e.chains,
          classification: e.classification,
        })),
      historyCount: hacks.data.totals.count,
      historyAmountUsd: hacks.data.totals.amountUsd,
    };
  }

  const ethPoints = activity.ok
    ? activity.data.filter((p) => p.asset === "ETH").sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const lastEth = ethPoints[ethPoints.length - 1] ?? null;

  // Precio y costo medio realizado comparten unidad y eje: se grafican juntos
  // porque la distancia entre ambos ES la lectura (ganancia latente del
  // conjunto de tenedores). MVRV va aparte, en su propia escala.
  const btcSeries = btc.ok
    ? downsample(
        btc.data.history.filter((p) => p.priceUsd !== null),
        90
      ).map((p) => ({
        date: p.date,
        priceUsd: p.priceUsd,
        realizedPriceUsd: p.realizedPriceUsd,
        mvrv: p.mvrv,
      }))
    : [];

  const payload: ReportPayload = {
    generatedAt: new Date().toISOString(),
    market: global.ok
      ? {
          totalMarketCapUsd: global.data.totalMarketCapUsd,
          marketCapChange24hPct: global.data.marketCapChange24hPct,
          btcDominancePct: global.data.btcDominancePct,
          volume24hUsd: global.data.totalVolume24hUsd ?? null,
          fearGreed: fng.ok ? { value: fng.data.value, classification: fng.data.classification } : null,
        }
      : null,
    defi: {
      tvlUsd: tvlHistory.ok ? tvlHistory.data[tvlHistory.data.length - 1]?.tvlUsd ?? null : null,
      tvlChange7dPct: tvlHistory.ok ? changePct(tvlHistory.data, 7) : null,
      tvlChange30dPct: tvlHistory.ok ? changePct(tvlHistory.data, 30) : null,
      dexVolume24hUsd: dex.ok ? dex.data.total24hUsd : null,
      dexChange7dPct: dex.ok ? dex.data.change7dPct : null,
      tvlSeries: tvlHistory.ok ? tvlHistory.data.slice(-30) : [],
      categoryMix,
      universeSize: protocols.ok ? protocols.data.length : 0,
      topProtocols: protocols.ok
        ? protocols.data.slice(0, 8).map((p) => ({
            name: p.name,
            category: p.category,
            chain: p.chain,
            tvlUsd: p.tvlUsd,
            change7dPct: p.change7dPct,
          }))
        : [],
      topRevenue: revenue.ok
        ? revenue.data.map((p) => ({ name: p.name, revenue24hUsd: p.revenue24hUsd }))
        : [],
    },
    chains: chainRows,
    chainConcentration:
      chainTotal > 0 && rankedChains.length >= 5
        ? {
            top1Pct: (rankedChains[0].tvlUsd / chainTotal) * 100,
            top5Pct:
              (rankedChains.slice(0, 5).reduce((s, c) => s + c.tvlUsd, 0) / chainTotal) * 100,
            total: rankedChains.length,
          }
        : null,
    networks,
    weights: blockchainsJson.weights as Weights,
    activity: {
      btcSeries,
      ethSeries: ethPoints.map((p) => ({
        date: p.date,
        transactions: p.transactions,
        activeAddresses: p.activeAddresses,
      })),
      btc: btc.ok
        ? {
            asOf: btc.data.asOf,
            priceUsd: btc.data.snapshot.priceUsd,
            realizedPriceUsd: btc.data.snapshot.realizedPriceUsd,
            mvrv: btc.data.snapshot.mvrv,
            transactions: btc.data.snapshot.transactions,
            activeAddresses: btc.data.snapshot.activeAddresses,
            feesBtc: btc.data.snapshot.feesBtc,
            hashRateEh: btc.data.snapshot.hashRateEh,
            exchangeSupplyBtc: btc.data.snapshot.exchangeSupplyBtc,
            exchangeSupply30dChangeBtc: btc.data.signals.exchangeSupply30dChangeBtc,
            preliminary: btc.data.preliminary,
          }
        : null,
      eth: lastEth
        ? {
            date: lastEth.date,
            transactions: lastEth.transactions,
            activeAddresses: lastEth.activeAddresses,
          }
        : null,
    },
    tokenization: {
      onchainMcapUsd: rwaDashboard.ok ? rwaDashboard.data.onchainMcapUsd : null,
      activeMcapUsd: rwaDashboard.ok ? rwaDashboard.data.activeMcapUsd : null,
      defiActiveTvlUsd: rwaDashboard.ok ? rwaDashboard.data.defiActiveTvlUsd : null,
      issuerCount: rwaDashboard.ok ? rwaDashboard.data.issuerCount : null,
      protocolTvlUsd,
      protocolCount: rwa.ok ? rwa.data.length : null,
      topSectors,
      topProtocols: rwa.ok
        ? rwa.data.slice(0, 6).map((p) => ({
            name: p.name,
            chain: p.chain,
            tvlUsd: p.tvlUsd,
            change7dPct: p.change7dPct,
          }))
        : [],
    },
    stablecoins: {
      supplySeries: stableHistory.ok ? stableHistory.data.slice(-90) : [],
      totalUsd: stableTotal.ok ? stableTotal.data.totalUsd : null,
      change7dPct: stableTotal.ok ? stableTotal.data.change7dPct : null,
      change30dPct: stableTotal.ok ? stableTotal.data.change30dPct : null,
      dominantSymbol: stableTotal.ok ? stableTotal.data.dominantSymbol : null,
      dominancePct: stableTotal.ok ? stableTotal.data.dominancePct : null,
      topIssuers: stables.ok
        ? stables.data.map((s) => ({
            symbol: s.symbol,
            name: s.name,
            circulatingUsd: s.circulatingUsd,
            change7dPct: s.change7dPct,
            pegMechanism: s.pegMechanism,
          }))
        : [],
      topChains:
        stableTotal.ok && stableTotal.data.chainBreakdownAvailable
          ? stableTotal.data.byChain.slice(0, 6).map((c) => ({
              chain: c.chain,
              circulatingUsd: c.circulatingUsd,
              sharePct:
                stableTotal.data.attributedUsd > 0
                  ? (c.circulatingUsd / stableTotal.data.attributedUsd) * 100
                  : 0,
            }))
          : [],
    },
    cbdc: {
      asOf: cbdcJson.asOf as string,
      byStatus,
      total: jurisdictions.length,
    },
    security,
    sources: [
      track("Mercado global", global),
      track("Sentimiento", fng),
      track("TVL DeFi", tvlHistory),
      track("TVL por red", chains),
      track("Volumen DEX", dex),
      track("Protocolos", protocols),
      track("Revenue", revenue),
      track("Mercado RWA", rwaDashboard),
      track("Protocolos RWA", rwa),
      track("Stablecoins", stables),
      track("Market cap stablecoins", stableTotal),
      track("Stablecoins por red", stableByChain),
      track("Actividad comparada BBI", blockchain.activity),
      track("Bitcoin on-chain", btc),
      track("Actividad de red", activity),
      track("Incidentes de seguridad", hacks),
      track("Serie de oferta stablecoins", stableHistory),
    ],
  };

  return jsonCached(payload, FRESH.minutes10);
}
