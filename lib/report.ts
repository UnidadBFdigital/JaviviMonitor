// Contrato del Blockchain Landscape Report. Vive fuera de la ruta para que
// el documento (componente de cliente) pueda tiparse sin importar nada del
// servidor.
//
// El informe se lee en gráficos, no en tablas: además del corte puntual de
// cada bloque, el payload viaja con las series que esos gráficos dibujan
// (TVL, precio/costo base de BTC, actividad de red, oferta de stablecoins,
// cadencia de incidentes). Las series salen de las mismas llamadas que ya
// alimentaban las cifras — no agregan una sola petición de red.

import type { Network, Weights } from "@/lib/bbi";

export type ReportSource = {
  block: string;
  source: string;
  fetchedAt: string | null;
  ok: boolean;
  stale: boolean;
};

/** Los seis scores editoriales del dataset, en el orden del scorecard. */
export type ReportScores = {
  seguridad: number;
  adopcion: number;
  escalabilidad: number;
  ecosistema: number;
  institucional: number;
  compliance: number;
};

export type ReportNetwork = {
  name: string;
  group: string;
  type: string;
  consensus: string;
  bbi: number;
  bbiPartial: boolean;
  activityCoverage: number;
  activeAddresses24h: number | null;
  dexVolume24hUsd: number | null;
  chainFees24hUsd: number | null;
  tvlUsd: number | null;
  stablecoinSupplyUsd: number | null;
  economicFootprintUsd: number | null;
  actividadEconomica: number | null;
  scores: ReportScores;
  institutionalAdoption: string;
  regulatoryRisk: string;
  review?: Network["review"];
  referenceMetrics?: Network["referenceMetrics"];
};

export type TvlPoint = { date: string; tvlUsd: number };
export type BtcPoint = {
  date: string;
  priceUsd: number | null;
  realizedPriceUsd: number | null;
  mvrv: number | null;
};
export type EthPoint = { date: string; transactions: number | null; activeAddresses: number | null };
export type SupplyPoint = { date: string; totalUsd: number };
export type CadencePoint = { start: string; count: number; amountUsd: number };
export type MonthPoint = { label: string; count: number; amountUsd: number };

export type ReportPayload = {
  generatedAt: string;
  market: {
    totalMarketCapUsd: number;
    marketCapChange24hPct: number;
    btcDominancePct: number;
    volume24hUsd: number | null;
    fearGreed: { value: number; classification: string } | null;
  } | null;
  defi: {
    tvlUsd: number | null;
    tvlChange7dPct: number | null;
    tvlChange30dPct: number | null;
    dexVolume24hUsd: number | null;
    dexChange7dPct: number | null;
    /** serie de 30 días del TVL agregado — insumo del área de la sección 01 */
    tvlSeries: TvlPoint[];
    topProtocols: { name: string; category: string; chain: string; tvlUsd: number; change7dPct: number | null }[];
    topRevenue: { name: string; revenue24hUsd: number }[];
    /** reparto por categoría sobre los protocolos más grandes (ver universeSize) */
    categoryMix: { category: string; tvlUsd: number; count: number }[];
    universeSize: number;
  };
  chains: { name: string; tvlUsd: number; sharePct: number }[];
  chainConcentration: { top1Pct: number; top5Pct: number; total: number } | null;
  networks: ReportNetwork[];
  weights: Weights;
  activity: {
    btc: {
      asOf: string;
      priceUsd: number | null;
      realizedPriceUsd: number | null;
      mvrv: number | null;
      transactions: number | null;
      activeAddresses: number | null;
      feesBtc: number | null;
      hashRateEh: number | null;
      exchangeSupplyBtc: number | null;
      exchangeSupply30dChangeBtc: number | null;
      preliminary: string[];
    } | null;
    /** precio y costo medio realizado, misma unidad y mismo eje */
    btcSeries: BtcPoint[];
    eth: { date: string; transactions: number | null; activeAddresses: number | null } | null;
    ethSeries: EthPoint[];
  };
  tokenization: {
    onchainMcapUsd: number | null;
    activeMcapUsd: number | null;
    defiActiveTvlUsd: number | null;
    issuerCount: number | null;
    protocolTvlUsd: number | null;
    protocolCount: number | null;
    topSectors: { name: string; tvlUsd: number; sharePct: number; change7dPct: number | null }[];
    topProtocols: { name: string; chain: string; tvlUsd: number; change7dPct: number | null }[];
  };
  stablecoins: {
    totalUsd: number | null;
    change7dPct: number | null;
    change30dPct: number | null;
    dominantSymbol: string | null;
    dominancePct: number | null;
    topIssuers: { symbol: string; name: string; circulatingUsd: number; change7dPct: number | null; pegMechanism: string }[];
    topChains: { chain: string; circulatingUsd: number; sharePct: number }[];
    /** 90 días de oferta total — el área de la sección 04 */
    supplySeries: SupplyPoint[];
  };
  cbdc: {
    asOf: string;
    byStatus: { status: string; count: number; jurisdictions: string[] }[];
    total: number;
  };
  security: {
    windowDays: number;
    from: string;
    count: number;
    amountUsd: number;
    unpricedCount: number;
    weeksWithIncident: number;
    weeksObserved: number;
    longestStreak: number;
    topVectors: { key: string; count: number; amountUsd: number }[];
    topChains: { key: string; count: number; amountUsd: number }[];
    biggest: { date: string; name: string; amountUsd: number | null; chains: string[]; classification: string }[];
    /** 13 semanas incluidas las vacías — la cadencia se lee en los huecos */
    cadence: CadencePoint[];
    /** últimos 24 meses del registro completo, para dar escala al período */
    monthly: MonthPoint[];
    historyCount: number;
    historyAmountUsd: number;
  } | null;
  sources: ReportSource[];
};
