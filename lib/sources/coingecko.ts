// CoinGecko Demo API. La key se usa exclusivamente del lado servidor mediante
// header; nunca se incluye en URLs ni se expone al cliente.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

export const SOURCE = "CoinGecko";
const BASE = "https://api.coingecko.com/api/v3/";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchCoinGecko<T>(
  path: string,
  params: Record<string, string | number | boolean> = {}
): Promise<T> {
  const url = new URL(path.replace(/^\//, ""), BASE);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const demoKey = process.env.COINGECKO_DEMO_API_KEY?.trim();
  const headers: Record<string, string> = { accept: "application/json" };
  if (demoKey) headers["x-cg-demo-api-key"] = demoKey;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return response.json() as Promise<T>;

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt === 0) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await wait(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 3_000) : 750);
        continue;
      }
      throw new Error(`${SOURCE} ${url.pathname} → HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 0) {
        await wait(750);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`${SOURCE} ${url.pathname} → sin respuesta`);
}

export type GlobalMarket = {
  totalMarketCapUsd: number;
  totalVolume24hUsd: number;
  btcDominancePct: number;
  ethDominancePct: number;
  marketCapChange24hPct: number;
};

type RawGlobal = {
  data: {
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { btc: number; eth: number };
    market_cap_change_percentage_24h_usd: number;
  };
};

export async function getGlobalMarket(): Promise<SourceResult<GlobalMarket>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "coingecko:global",
      () => fetchCoinGecko<RawGlobal>("global"),
      10 * 60 * 1000
    );
    return {
      ok: true,
      data: {
        totalMarketCapUsd: data.data.total_market_cap.usd,
        totalVolume24hUsd: data.data.total_volume.usd,
        btcDominancePct: data.data.market_cap_percentage.btc,
        ethDominancePct: data.data.market_cap_percentage.eth,
        marketCapChange24hPct: data.data.market_cap_change_percentage_24h_usd,
      },
      source: SOURCE,
      fetchedAt,
      stale,
    };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- Fan tokens (categoría de CoinGecko) ---

export type FanToken = {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  change24hPct: number | null;
  change7dPct: number | null;
};

type RawMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  market_cap: number | null;
  total_volume: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  market_cap_rank?: number | null;
  fully_diluted_valuation?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  circulating_supply?: number | null;
  total_supply?: number | null;
  max_supply?: number | null;
  ath?: number | null;
  ath_change_percentage?: number | null;
  last_updated?: string | null;
};

export async function getFanTokens(limit = 50): Promise<SourceResult<FanToken[]>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      `coingecko:fan-tokens:${limit}`,
      async () => {
        const json = await fetchCoinGecko<RawMarket[]>("coins/markets", {
          vs_currency: "usd",
          category: "fan-token",
          order: "market_cap_desc",
          per_page: limit,
          page: 1,
          price_change_percentage: "24h,7d",
        });
        if (!Array.isArray(json)) throw new Error(`${SOURCE} fan-token → respuesta inesperada`);
        return json;
      },
      10 * 60 * 1000
    );

    const tokens = data
      .filter((t) => typeof t.market_cap === "number" && t.market_cap! > 0)
      .map((t) => ({
        id: t.id,
        symbol: t.symbol.toUpperCase(),
        name: t.name,
        priceUsd: t.current_price ?? 0,
        marketCapUsd: t.market_cap as number,
        volume24hUsd: t.total_volume ?? 0,
        change24hPct: t.price_change_percentage_24h_in_currency ?? null,
        change7dPct: t.price_change_percentage_7d_in_currency ?? null,
      }));

    return { ok: true, data: tokens, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

export type RwaMarketToken = {
  id: string;
  name: string;
  symbol: string;
  kind: "Producto respaldado" | "Infraestructura RWA";
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  turnover24hPct: number | null;
  fullyDilutedValuationUsd: number | null;
  floatPct: number | null;
  change24hPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  athDrawdownPct: number | null;
  lastUpdated: string;
};

type RawRwaMarket = {
  id: string;
  name: string;
  symbol: string;
  current_price?: number | null;
  market_cap?: number | null;
  total_volume?: number | null;
  fully_diluted_valuation?: number | null;
  circulating_supply?: number | null;
  max_supply?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  ath_change_percentage?: number | null;
  last_updated?: string | null;
};

// Productos cuyo token representa directamente un activo o derecho financiero.
// El resto de la categoría de CoinGecko se conserva como infraestructura RWA.
const ASSET_BACKED_IDS = new Set([
  "figure-heloc",
  "blackrock-usd-institutional-digital-liquidity-fund",
  "hashnote-usyc",
  "tether-gold",
  "ondo-us-dollar-yield",
  "pax-gold",
  "spiko-amundi-overnight-swap-fund-eur",
  "blockchain-capital",
  "eutbl",
  "janus-henderson-anemoy-treasury-fund",
  "superstate-short-duration-us-government-securities-fund-ustb",
  "janus-henderson-anemoy-aaa-clo-fund",
  "ylds",
]);

export async function getRwaMarketTokens(limit = 30): Promise<SourceResult<RwaMarketToken[]>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      `coingecko:rwa-market:${limit}`,
      async () => {
        const json = await fetchCoinGecko<RawRwaMarket[]>("coins/markets", {
          vs_currency: "usd",
          category: "real-world-assets-rwa",
          order: "market_cap_desc",
          per_page: Math.min(limit, 100),
          page: 1,
          sparkline: false,
          price_change_percentage: "24h,7d,30d",
        });
        if (!Array.isArray(json)) throw new Error(`${SOURCE} RWA category → respuesta inesperada`);
        return json;
      },
      30 * 60 * 1000
    );

    const tokens = data
      .map((token) => {
        const marketCapUsd = token.market_cap ?? 0;
        const volume24hUsd = token.total_volume ?? 0;
        const circulatingSupply = token.circulating_supply ?? null;
        const maxSupply = token.max_supply ?? null;
        return {
          id: token.id,
          name: token.name,
          symbol: token.symbol.toUpperCase(),
          kind: ASSET_BACKED_IDS.has(token.id)
            ? "Producto respaldado" as const
            : "Infraestructura RWA" as const,
          priceUsd: token.current_price ?? 0,
          marketCapUsd,
          volume24hUsd,
          turnover24hPct: marketCapUsd > 0 ? (volume24hUsd / marketCapUsd) * 100 : null,
          fullyDilutedValuationUsd: token.fully_diluted_valuation ?? null,
          floatPct:
            circulatingSupply !== null && maxSupply !== null && maxSupply > 0
              ? (circulatingSupply / maxSupply) * 100
              : null,
          change24hPct: token.price_change_percentage_24h_in_currency ?? null,
          change7dPct: token.price_change_percentage_7d_in_currency ?? null,
          change30dPct: token.price_change_percentage_30d_in_currency ?? null,
          athDrawdownPct: token.ath_change_percentage ?? null,
          lastUpdated: token.last_updated ?? fetchedAt,
        };
      })
      .filter((token) => token.marketCapUsd > 0);

    return { ok: true, data: tokens, source: SOURCE, fetchedAt, stale };
  } catch (error) {
    return { ok: false, source: SOURCE, error: String(error) };
  }
}

// --- Panorama líquido multiactivo ---

const CORE_ASSETS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink" },
] as const;

export type MarketAsset = {
  id: string;
  symbol: string;
  name: string;
  rank: number | null;
  priceUsd: number;
  marketCapUsd: number;
  fullyDilutedValuationUsd: number | null;
  volume24hUsd: number;
  turnover24hPct: number | null;
  dominancePct: number | null;
  high24hUsd: number | null;
  low24hUsd: number | null;
  change24hPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  athUsd: number | null;
  athDrawdownPct: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  floatPct: number | null;
  lastUpdated: string;
};

export async function getMarketAssets(): Promise<SourceResult<MarketAsset[]>> {
  try {
    const ids = CORE_ASSETS.map((asset) => asset.id).join(",");
    const { data, fetchedAt, stale } = await cached(
      "coingecko:core-market-assets:v1",
      async () => {
        const json = await fetchCoinGecko<RawMarket[]>("coins/markets", {
          vs_currency: "usd",
          ids,
          order: "market_cap_desc",
          sparkline: false,
          price_change_percentage: "24h,7d,30d",
        });
        if (!Array.isArray(json)) throw new Error(`${SOURCE} core assets → respuesta inesperada`);
        return json;
      },
      5 * 60 * 1000
    );

    const global = await getGlobalMarket();
    const totalMarketCapUsd = global.ok ? global.data.totalMarketCapUsd : 0;
    const assets = data
      .filter((asset) => typeof asset.market_cap === "number" && asset.market_cap > 0)
      .map((asset) => {
        const marketCapUsd = asset.market_cap as number;
        const maxSupply = asset.max_supply ?? null;
        const circulatingSupply = asset.circulating_supply ?? null;
        return {
          id: asset.id,
          symbol: asset.symbol.toUpperCase(),
          name: asset.name,
          rank: asset.market_cap_rank ?? null,
          priceUsd: asset.current_price ?? 0,
          marketCapUsd,
          fullyDilutedValuationUsd: asset.fully_diluted_valuation ?? null,
          volume24hUsd: asset.total_volume ?? 0,
          turnover24hPct:
            marketCapUsd > 0 && typeof asset.total_volume === "number"
              ? (asset.total_volume / marketCapUsd) * 100
              : null,
          dominancePct: totalMarketCapUsd > 0 ? (marketCapUsd / totalMarketCapUsd) * 100 : null,
          high24hUsd: asset.high_24h ?? null,
          low24hUsd: asset.low_24h ?? null,
          change24hPct: asset.price_change_percentage_24h_in_currency ?? null,
          change7dPct: asset.price_change_percentage_7d_in_currency ?? null,
          change30dPct: asset.price_change_percentage_30d_in_currency ?? null,
          athUsd: asset.ath ?? null,
          athDrawdownPct: asset.ath_change_percentage ?? null,
          circulatingSupply,
          maxSupply,
          floatPct:
            circulatingSupply !== null && maxSupply !== null && maxSupply > 0
              ? (circulatingSupply / maxSupply) * 100
              : null,
          lastUpdated: asset.last_updated ?? fetchedAt,
        } satisfies MarketAsset;
      });

    return { ok: true, data: assets, source: SOURCE, fetchedAt, stale };
  } catch (error) {
    return { ok: false, source: SOURCE, error: String(error) };
  }
}

// --- Rendimiento relativo de los activos principales ---

type RawMarketChart = {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
};

export type MarketPerformanceAsset = {
  id: string;
  symbol: string;
  name: string;
  returnPct: number;
  maxDrawdownPct: number;
  volatilityAnnPct: number | null;
};

export type MarketPerformancePoint = {
  date: string;
  [assetId: string]: string | number | null;
};

export type MarketPerformance = {
  days: number;
  assets: MarketPerformanceAsset[];
  points: MarketPerformancePoint[];
};

function performanceStats(prices: number[]): Pick<MarketPerformanceAsset, "returnPct" | "maxDrawdownPct" | "volatilityAnnPct"> {
  const first = prices[0] ?? 0;
  const last = prices[prices.length - 1] ?? 0;
  let peak = first;
  let maxDrawdownPct = 0;
  const dailyReturns: number[] = [];

  for (let index = 0; index < prices.length; index++) {
    const price = prices[index];
    peak = Math.max(peak, price);
    if (peak > 0) maxDrawdownPct = Math.min(maxDrawdownPct, ((price - peak) / peak) * 100);
    if (index > 0 && prices[index - 1] > 0) {
      dailyReturns.push(Math.log(price / prices[index - 1]));
    }
  }

  let volatilityAnnPct: number | null = null;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (dailyReturns.length - 1);
    volatilityAnnPct = Math.sqrt(variance) * Math.sqrt(365) * 100;
  }

  return {
    returnPct: first > 0 ? ((last - first) / first) * 100 : 0,
    maxDrawdownPct,
    volatilityAnnPct,
  };
}

export async function getMarketPerformance(days = 90): Promise<SourceResult<MarketPerformance>> {
  try {
    const selected = CORE_ASSETS.slice(0, 4);
    const safeDays = Math.max(7, Math.min(days, 365));
    const { data, fetchedAt, stale } = await cached(
      `coingecko:market-performance:${safeDays}:v1`,
      async () => {
        const results = await Promise.all(
          selected.map(async (asset) => {
            try {
              const chart = await fetchCoinGecko<RawMarketChart>(`coins/${asset.id}/market_chart`, {
                vs_currency: "usd",
                days: safeDays,
                interval: "daily",
              });
              return chart.prices?.length > 1 ? { asset, chart } : null;
            } catch {
              return null;
            }
          })
        );
        const available = results.filter((item): item is NonNullable<typeof item> => item !== null);
        if (available.length < 2) throw new Error(`${SOURCE} performance → series insuficientes`);
        return available;
      },
      30 * 60 * 1000
    );

    const byDate = new Map<string, MarketPerformancePoint>();
    const assets: MarketPerformanceAsset[] = [];

    for (const { asset, chart } of data) {
      const ordered = [...chart.prices]
        .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]) && point[1] > 0)
        .sort((a, b) => a[0] - b[0]);
      const firstPrice = ordered[0]?.[1] ?? 0;
      if (firstPrice <= 0) continue;

      for (const [timestamp, price] of ordered) {
        const date = new Date(timestamp).toISOString().slice(0, 10);
        const point = byDate.get(date) ?? { date };
        point[asset.id] = (price / firstPrice) * 100;
        byDate.set(date, point);
      }

      assets.push({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        ...performanceStats(ordered.map((point) => point[1])),
      });
    }

    const points = [...byDate.values()]
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .filter((point) => assets.some((asset) => typeof point[asset.id] === "number"));

    return {
      ok: true,
      data: { days: safeDays, assets, points },
      source: SOURCE,
      fetchedAt,
      stale,
    };
  } catch (error) {
    return { ok: false, source: SOURCE, error: String(error) };
  }
}

// --- Histórico diario de un activo ---

export type AssetHistory = {
  prices: { date: string; value: number }[];
  marketCaps: { date: string; value: number }[];
  volumes: { date: string; value: number }[];
};

type RawAssetChart = {
  prices?: [number, number][];
  market_caps?: [number, number][];
  total_volumes?: [number, number][];
};

function dailyFromPairs(pairs: [number, number][] | undefined): { date: string; value: number }[] {
  const byDay = new Map<string, { time: number; value: number }>();
  for (const [time, value] of pairs ?? []) {
    if (!Number.isFinite(time) || !Number.isFinite(value) || value < 0) continue;
    const date = new Date(time).toISOString().slice(0, 10);
    const previous = byDay.get(date);
    if (!previous || time >= previous.time) byDay.set(date, { time, value });
  }
  return [...byDay.entries()]
    .map(([date, p]) => ({ date, value: p.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Precio, capitalización y volumen diarios de un activo. La API demo de
 * CoinGecko limita el histórico a 365 días (`days=max` responde 10012), así que
 * el techo es un año y la ficha lo declara.
 */
export async function getAssetHistory(id: string, days = 365): Promise<SourceResult<AssetHistory>> {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return { ok: false, source: SOURCE, error: "id de activo inválido" };
  const safeDays = Math.max(7, Math.min(Math.round(days), 365));
  try {
    const { data, fetchedAt, stale } = await cached(
      `coingecko:assetHistory:${id}:${safeDays}`,
      async () => {
        const chart = await fetchCoinGecko<RawAssetChart>(`coins/${id}/market_chart`, {
          vs_currency: "usd",
          days: safeDays,
          interval: "daily",
        });
        return {
          prices: dailyFromPairs(chart.prices),
          marketCaps: dailyFromPairs(chart.market_caps),
          volumes: dailyFromPairs(chart.total_volumes),
        };
      },
      60 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
