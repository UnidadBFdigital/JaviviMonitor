// Universo del screener de Crypto Markets: los ~1000 activos de mayor market
// cap de CoinGecko, más una búsqueda a demanda para lo que queda fuera.
//
// Presupuesto de la API demo: 4 llamadas por refresco del universo (cada 5
// minutos, solo si alguien lo pide) y 2 por término buscado fuera del top,
// cacheadas 30 minutos.

import { cached } from "@/lib/cache";
import { thumbUrl, type ScreenerCoin } from "@/lib/marketScreener";
import { fetchCoinGecko, SOURCE } from "./coingecko";
import type { SourceResult } from "./types";

type RawScreenerCoin = {
  id?: unknown;
  symbol?: unknown;
  name?: unknown;
  image?: unknown;
  current_price?: unknown;
  market_cap?: unknown;
  market_cap_rank?: unknown;
  total_volume?: unknown;
  high_24h?: unknown;
  low_24h?: unknown;
  ath_change_percentage?: unknown;
  price_change_percentage_1h_in_currency?: unknown;
  price_change_percentage_24h_in_currency?: unknown;
  price_change_percentage_7d_in_currency?: unknown;
  price_change_percentage_30d_in_currency?: unknown;
};

const PAGE_SIZE = 250;
export const UNIVERSE_PAGES = 4;
const CHANGES = "1h,24h,7d,30d";

/** Un número ausente o no finito es null: nunca un cero que parezca dato. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toScreenerCoin(raw: RawScreenerCoin): ScreenerCoin | null {
  if (typeof raw.id !== "string" || typeof raw.symbol !== "string" || typeof raw.name !== "string") return null;
  const marketCap = num(raw.market_cap);
  return {
    id: raw.id,
    symbol: raw.symbol.toUpperCase(),
    name: raw.name,
    image: thumbUrl(raw.image),
    rank: num(raw.market_cap_rank),
    priceUsd: num(raw.current_price),
    change1hPct: num(raw.price_change_percentage_1h_in_currency),
    change24hPct: num(raw.price_change_percentage_24h_in_currency),
    change7dPct: num(raw.price_change_percentage_7d_in_currency),
    change30dPct: num(raw.price_change_percentage_30d_in_currency),
    // CoinGecko publica 0 cuando no conoce la oferta circulante
    marketCapUsd: marketCap !== null && marketCap > 0 ? marketCap : null,
    volume24hUsd: num(raw.total_volume),
    high24hUsd: num(raw.high_24h),
    low24hUsd: num(raw.low_24h),
    athDrawdownPct: num(raw.ath_change_percentage),
  };
}

function marketsPage(page: number): Promise<RawScreenerCoin[]> {
  return fetchCoinGecko<RawScreenerCoin[]>("coins/markets", {
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: PAGE_SIZE,
    page,
    sparkline: false,
    price_change_percentage: CHANGES,
  });
}

export type MarketUniverse = { coins: ScreenerCoin[]; pagesLoaded: number; pagesRequested: number };

export async function getMarketUniverse(): Promise<SourceResult<MarketUniverse>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "coingecko:universe:v1",
      async () => {
        const pages: RawScreenerCoin[][] = [];
        // de a dos páginas por vez: la API demo admite 30 llamadas por minuto
        for (let first = 1; first <= UNIVERSE_PAGES; first += 2) {
          const numbers = [first, first + 1].filter((n) => n <= UNIVERSE_PAGES);
          const batch = await Promise.all(numbers.map((n) => marketsPage(n).catch(() => null)));
          const cut = batch.findIndex((page) => !Array.isArray(page) || page.length === 0);
          pages.push(...(batch.slice(0, cut === -1 ? batch.length : cut) as RawScreenerCoin[][]));
          // solo un prefijo contiguo: una página faltante dejaría un hueco de rangos
          if (cut !== -1) break;
        }
        if (pages.length === 0) throw new Error(`${SOURCE} coins/markets → sin páginas`);

        // entre página y página el ranking puede moverse: un id aparece una vez
        const byId = new Map<string, ScreenerCoin>();
        for (const raw of pages.flat()) {
          const coin = toScreenerCoin(raw);
          if (coin && !byId.has(coin.id)) byId.set(coin.id, coin);
        }
        return { coins: [...byId.values()], pagesLoaded: pages.length, pagesRequested: UNIVERSE_PAGES };
      },
      5 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (error) {
    return { ok: false, source: SOURCE, error: String(error) };
  }
}

/** Activos fuera del universo que coinciden con una búsqueda, con su precio. */
export async function searchCoinGecko(query: string): Promise<SourceResult<ScreenerCoin[]>> {
  const q = query.trim().toLowerCase();
  if (q.length < 2 || q.length > 40) return { ok: false, source: SOURCE, error: "búsqueda inválida" };
  try {
    const { data, fetchedAt, stale } = await cached(
      `coingecko:search:v1:${q}`,
      async () => {
        const found = await fetchCoinGecko<{ coins?: { id?: unknown }[] }>("search", { query: q });
        const ids = (found.coins ?? [])
          .map((c) => c.id)
          .filter((id): id is string => typeof id === "string" && /^[a-z0-9-]{1,80}$/.test(id))
          .slice(0, 25);
        if (ids.length === 0) return [];
        const raw = await fetchCoinGecko<RawScreenerCoin[]>("coins/markets", {
          vs_currency: "usd",
          ids: ids.join(","),
          per_page: 25,
          page: 1,
          sparkline: false,
          price_change_percentage: CHANGES,
        });
        return Array.isArray(raw) ? raw.flatMap((r) => toScreenerCoin(r) ?? []) : [];
      },
      30 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (error) {
    return { ok: false, source: SOURCE, error: String(error) };
  }
}
