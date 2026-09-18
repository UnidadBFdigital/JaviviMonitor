import { cached } from "@/lib/cache";
import { observableNumber } from "@/lib/bbiMethodology";
import type { SourceResult } from "./types";

const PUBLIC_READER_BASE = "https://r.jina.ai/https://defillama.com";

export const CHAIN_ACTIVITY_SOURCE = "DeFiLlama Chains Dashboard";
export const STABLECOIN_MARKET_SOURCE = "DeFiLlama Stablecoins Dashboard";

async function fetchDashboardHtml(path: string): Promise<string> {
  const response = await fetch(`${PUBLIC_READER_BASE}${path}`, {
    cache: "no-store",
    headers: {
      accept: "text/html",
      "x-return-format": "html",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`Render publico de DeFiLlama ${path} -> HTTP ${response.status}`);
  }
  const html = await response.text();
  if (html.length > 12 * 1024 * 1024) {
    throw new Error(`Respuesta de DeFiLlama ${path} demasiado grande`);
  }
  return html;
}

function pagePropsFromHtml<T>(html: string): T {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start === -1) throw new Error("DeFiLlama no incluyo __NEXT_DATA__");
  const jsonStart = start + marker.length;
  const end = html.indexOf("</script>", jsonStart);
  if (end === -1) throw new Error("DeFiLlama devolvio __NEXT_DATA__ incompleto");

  const parsed = JSON.parse(html.slice(jsonStart, end)) as {
    props?: { pageProps?: T };
  };
  if (!parsed.props?.pageProps) throw new Error("DeFiLlama no incluyo pageProps");
  return parsed.props.pageProps;
}

function positiveNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export type ChainActivityMetric = {
  name: string;
  activeAddresses24h: number | null;
  tvlUsd: number | null;
  stablecoinMcapUsd: number | null;
  dexVolume24hUsd: number | null;
  dexVolume7dUsd: number | null;
  chainFees24hUsd: number | null;
  chainFees7dUsd: number | null;
  chainRevenue24hUsd: number | null;
  appRevenue24hUsd: number | null;
  protocolCount: number | null;
};

type RawDashboardChain = {
  name?: unknown;
  activeUsers24h?: unknown;
  tvl?: unknown;
  stablesMcap?: unknown;
  dexVolume24h?: unknown;
  dexVolume7d?: unknown;
  fees24h?: unknown;
  fees7d?: unknown;
  revenue24h?: unknown;
  appRevenue24h?: unknown;
  protocols?: unknown;
};

type ChainsPageProps = { chains?: RawDashboardChain[] };

export function parseChainActivityPage(html: string): ChainActivityMetric[] {
  const props = pagePropsFromHtml<ChainsPageProps>(html);
  return (props.chains ?? []).flatMap((chain): ChainActivityMetric[] => {
    if (typeof chain.name !== "string" || !chain.name.trim()) return [];
    return [{
      name: chain.name,
      activeAddresses24h: observableNumber(chain.activeUsers24h),
      tvlUsd: observableNumber(chain.tvl),
      stablecoinMcapUsd: observableNumber(chain.stablesMcap),
      dexVolume24hUsd: observableNumber(chain.dexVolume24h),
      dexVolume7dUsd: observableNumber(chain.dexVolume7d),
      chainFees24hUsd: observableNumber(chain.fees24h),
      chainFees7dUsd: observableNumber(chain.fees7d),
      chainRevenue24hUsd: observableNumber(chain.revenue24h),
      appRevenue24hUsd: observableNumber(chain.appRevenue24h),
      protocolCount: observableNumber(chain.protocols),
    }];
  }).sort((a, b) => (b.activeAddresses24h ?? -1) - (a.activeAddresses24h ?? -1));
}

export async function getChainActivityMetrics(): Promise<SourceResult<ChainActivityMetric[]>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "defillama:chains-dashboard:v2",
      async () => {
        const rows = parseChainActivityPage(
          await fetchDashboardHtml("/chains?addresses=true")
        );
        if (rows.filter(row => row.activeAddresses24h !== null).length < 5) {
          throw new Error("DeFiLlama devolvio actividad para menos de cinco redes");
        }
        return rows;
      },
      30 * 60 * 1000
    );
    return { ok: true, data, source: CHAIN_ACTIVITY_SOURCE, fetchedAt, stale };
  } catch (error) {
    return { ok: false, source: CHAIN_ACTIVITY_SOURCE, error: String(error) };
  }
}

export type OfficialStablecoinPoint = { date: string; totalUsd: number };

export type OfficialStablecoinMarket = {
  totalUsd: number;
  change1dPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  change1dUsd: number | null;
  change7dUsd: number | null;
  change30dUsd: number | null;
  dominantSymbol: string | null;
  dominantMcapUsd: number | null;
  dominancePct: number | null;
  dataTimestamp: string;
  history: OfficialStablecoinPoint[];
  sourceUrl: string;
  methodology: string;
};

type StablecoinSummary = {
  totalMcapCurrent?: unknown;
  change1d?: unknown;
  change7d?: unknown;
  change30d?: unknown;
  change1dUsd?: unknown;
  change7dUsd?: unknown;
  change30dUsd?: unknown;
  dominance?: unknown;
  dataTimestamp?: unknown;
  topToken?: { symbol?: unknown; mcap?: unknown };
};

type StablecoinsPageProps = {
  defaultChartData?: {
    summary?: StablecoinSummary;
    dataset?: { source?: unknown[] };
  };
};

function nullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseOfficialStablecoinPage(html: string): OfficialStablecoinMarket {
  const props = pagePropsFromHtml<StablecoinsPageProps>(html);
  const chart = props.defaultChartData;
  const summary = chart?.summary;
  const totalUsd = positiveNumber(summary?.totalMcapCurrent);
  if (totalUsd === 0) throw new Error("DeFiLlama no devolvio el market cap oficial de stablecoins");

  const history = (chart?.dataset?.source ?? [])
    .flatMap((row): OfficialStablecoinPoint[] => {
      if (!Array.isArray(row) || row.length < 2) return [];
      const timestamp = Number(row[0]);
      const value = positiveNumber(row[1]);
      if (!Number.isFinite(timestamp) || timestamp <= 0 || value <= 0) return [];
      return [{ date: new Date(timestamp).toISOString().slice(0, 10), totalUsd: value }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (history.length < 30) throw new Error("Serie oficial de stablecoins insuficiente");
  const latest = history[history.length - 1].totalUsd;
  if (Math.abs(latest - totalUsd) / totalUsd > 0.02) {
    throw new Error("Cabecera y serie oficial de stablecoins no son consistentes");
  }

  const timestamp = Number(summary?.dataTimestamp);
  return {
    totalUsd,
    change1dPct: nullableNumber(summary?.change1d),
    change7dPct: nullableNumber(summary?.change7d),
    change30dPct: nullableNumber(summary?.change30d),
    change1dUsd: nullableNumber(summary?.change1dUsd),
    change7dUsd: nullableNumber(summary?.change7dUsd),
    change30dUsd: nullableNumber(summary?.change30dUsd),
    dominantSymbol:
      typeof summary?.topToken?.symbol === "string" ? summary.topToken.symbol : null,
    dominantMcapUsd: nullableNumber(summary?.topToken?.mcap),
    dominancePct: nullableNumber(summary?.dominance),
    dataTimestamp:
      Number.isFinite(timestamp) && timestamp > 0
        ? new Date(timestamp * 1000).toISOString()
        : new Date().toISOString(),
    history,
    sourceUrl: "https://defillama.com/stablecoins",
    methodology:
      "Market cap oficial de DeFiLlama: excluye activos marcados como doublecounted y aplica la valuacion de mercado del dashboard; no es la suma bruta de /stablecoincharts/all.",
  };
}

export async function getOfficialStablecoinMarket(): Promise<SourceResult<OfficialStablecoinMarket>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "defillama:stablecoins-dashboard:v1",
      async () => parseOfficialStablecoinPage(await fetchDashboardHtml("/stablecoins")),
      30 * 60 * 1000
    );
    return { ok: true, data, source: STABLECOIN_MARKET_SOURCE, fetchedAt, stale };
  } catch (error) {
    return { ok: false, source: STABLECOIN_MARKET_SOURCE, error: String(error) };
  }
}
