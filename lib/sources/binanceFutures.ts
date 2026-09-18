import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

const BASE = "https://fapi.binance.com";
export const BINANCE_FUTURES_SOURCE = "Binance USD-M Futures";

type PremiumIndex = {
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  time: number;
};

type OpenInterestPoint = {
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
};

type LongShortPoint = {
  longAccount: string;
  shortAccount: string;
  longShortRatio: string;
  timestamp: number;
};

type TakerPoint = {
  buySellRatio: string;
  buyVol: string;
  sellVol: string;
  timestamp: number;
};

export type LiquidationScenario = {
  leverage: number;
  distancePct: number;
  longLiquidationUsd: number;
  shortLiquidationUsd: number;
};

export type BitcoinDerivativesPoint = {
  time: string;
  openInterestUsd: number | null;
  openInterestBtc: number | null;
  globalLongPct: number | null;
  topTraderLongPct: number | null;
  takerBuyPct: number | null;
};

export type BitcoinDerivativesData = {
  markPriceUsd: number;
  indexPriceUsd: number;
  fundingRatePct: number;
  fundingAnnualizedPct: number;
  nextFundingTime: string;
  openInterestUsd: number | null;
  openInterestBtc: number | null;
  openInterest24hChangePct: number | null;
  globalLongPct: number | null;
  topTraderLongPct: number | null;
  takerBuyPct: number | null;
  history: BitcoinDerivativesPoint[];
  liquidationScenarios: LiquidationScenario[];
};

async function fetchJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${BINANCE_FUTURES_SOURCE} ${path} -> HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function finite(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ratioToPercent(value: string | undefined): number | null {
  const ratio = finite(value);
  return ratio === null ? null : (ratio / (1 + ratio)) * 100;
}

export async function getBitcoinDerivativesData(): Promise<SourceResult<BitcoinDerivativesData>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "binance-futures:btc-intelligence:1h:168",
      async () => {
        const common = { symbol: "BTCUSDT", period: "1h", limit: "168" };
        const [premium, openInterest, globalRatio, topRatio, takerRatio] = await Promise.all([
          fetchJson<PremiumIndex>("/fapi/v1/premiumIndex", { symbol: "BTCUSDT" }),
          fetchJson<OpenInterestPoint[]>("/futures/data/openInterestHist", common),
          fetchJson<LongShortPoint[]>("/futures/data/globalLongShortAccountRatio", common),
          fetchJson<LongShortPoint[]>("/futures/data/topLongShortPositionRatio", common),
          fetchJson<TakerPoint[]>("/futures/data/takerlongshortRatio", common),
        ]);
        return { premium, openInterest, globalRatio, topRatio, takerRatio };
      },
      5 * 60 * 1000
    );

    const markPriceUsd = Number(data.premium.markPrice);
    const indexPriceUsd = Number(data.premium.indexPrice);
    if (!Number.isFinite(markPriceUsd) || !Number.isFinite(indexPriceUsd)) {
      throw new Error(`${BINANCE_FUTURES_SOURCE}: invalid mark price`);
    }

    const rows = new Map<number, BitcoinDerivativesPoint>();
    const rowFor = (timestamp: number) => {
      const existing = rows.get(timestamp);
      if (existing) return existing;
      const row: BitcoinDerivativesPoint = {
        time: new Date(timestamp).toISOString(),
        openInterestUsd: null,
        openInterestBtc: null,
        globalLongPct: null,
        topTraderLongPct: null,
        takerBuyPct: null,
      };
      rows.set(timestamp, row);
      return row;
    };

    data.openInterest.forEach((point) => {
      const row = rowFor(point.timestamp);
      row.openInterestUsd = finite(point.sumOpenInterestValue);
      row.openInterestBtc = finite(point.sumOpenInterest);
    });
    data.globalRatio.forEach((point) => {
      rowFor(point.timestamp).globalLongPct = finite(point.longAccount) === null
        ? ratioToPercent(point.longShortRatio)
        : Number(point.longAccount) * 100;
    });
    data.topRatio.forEach((point) => {
      rowFor(point.timestamp).topTraderLongPct = finite(point.longAccount) === null
        ? ratioToPercent(point.longShortRatio)
        : Number(point.longAccount) * 100;
    });
    data.takerRatio.forEach((point) => {
      rowFor(point.timestamp).takerBuyPct = ratioToPercent(point.buySellRatio);
    });

    const history = [...rows.values()].sort((a, b) => a.time.localeCompare(b.time));
    const oiHistory = history.filter((point) => point.openInterestUsd !== null);
    const latestOi = oiHistory.at(-1);
    const oi24hAgo = oiHistory[Math.max(0, oiHistory.length - 25)];
    const latestGlobal = history.findLast((point) => point.globalLongPct !== null);
    const latestTop = history.findLast((point) => point.topTraderLongPct !== null);
    const latestTaker = history.findLast((point) => point.takerBuyPct !== null);
    const fundingRatePct = Number(data.premium.lastFundingRate) * 100;
    const leverages = [3, 5, 10, 25, 50, 100];

    return {
      ok: true,
      data: {
        markPriceUsd,
        indexPriceUsd,
        fundingRatePct,
        fundingAnnualizedPct: fundingRatePct * 3 * 365,
        nextFundingTime: new Date(data.premium.nextFundingTime).toISOString(),
        openInterestUsd: latestOi?.openInterestUsd ?? null,
        openInterestBtc: latestOi?.openInterestBtc ?? null,
        openInterest24hChangePct: latestOi?.openInterestUsd !== null && latestOi?.openInterestUsd !== undefined && oi24hAgo?.openInterestUsd !== null && oi24hAgo?.openInterestUsd !== undefined && oi24hAgo.openInterestUsd !== 0
          ? ((latestOi.openInterestUsd / oi24hAgo.openInterestUsd) - 1) * 100
          : null,
        globalLongPct: latestGlobal?.globalLongPct ?? null,
        topTraderLongPct: latestTop?.topTraderLongPct ?? null,
        takerBuyPct: latestTaker?.takerBuyPct ?? null,
        history,
        liquidationScenarios: leverages.map((leverage) => ({
          leverage,
          distancePct: 100 / leverage,
          longLiquidationUsd: markPriceUsd * (1 - 1 / leverage),
          shortLiquidationUsd: markPriceUsd * (1 + 1 / leverage),
        })),
      },
      source: BINANCE_FUTURES_SOURCE,
      fetchedAt,
      stale,
    };
  } catch (error) {
    return { ok: false, source: BINANCE_FUTURES_SOURCE, error: String(error) };
  }
}
