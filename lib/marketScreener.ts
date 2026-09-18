// Screener de criptoactivos: filtro, orden y paginado puros sobre el universo
// que entrega CoinGecko. Vive fuera de la ruta para probarlo sin red; el
// servidor pagina y el navegador solo recibe la página visible.

export type ScreenerCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  rank: number | null;
  priceUsd: number | null;
  change1hPct: number | null;
  change24hPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  high24hUsd: number | null;
  low24hUsd: number | null;
  athDrawdownPct: number | null;
};

export const SCREENER_SORTS = ["rank", "price", "d1h", "d24h", "d7d", "d30d", "mcap", "volume", "ath"] as const;
export type ScreenerSort = (typeof SCREENER_SORTS)[number];
export type SortDir = "asc" | "desc";

export const PAGE_SIZES = [25, 50, 100] as const;

export type ScreenerQuery = { q: string; sort: ScreenerSort; dir: SortDir; page: number; size: number };

export type ScreenerPage = { rows: ScreenerCoin[]; total: number; page: number; pages: number };

/** Respuesta de /api/market/screener. */
export type ScreenerPayload =
  | (ScreenerPage & {
      ok: true;
      query: ScreenerQuery;
      /** activos del universo cargado (top por market cap) */
      universe: number;
      pagesLoaded: number;
      pagesRequested: number;
      /** búsqueda fuera del top: no pedida, resuelta o fallida */
      deep: "off" | "ok" | "failed";
      /** activos agregados por la búsqueda fuera del top */
      extra: number;
      source: string;
      fetchedAt: string;
      stale: boolean;
    })
  | { ok: false; source: string; error: string };

const MAX_QUERY = 40;

/** Parámetros de la URL a una consulta válida; lo inválido cae al valor por defecto. */
export function parseScreenerQuery(params: URLSearchParams): ScreenerQuery {
  const sort = params.get("sort");
  const size = Number(params.get("size"));
  const page = Number(params.get("page"));
  return {
    q: (params.get("q") ?? "").trim().toLowerCase().slice(0, MAX_QUERY),
    sort: SCREENER_SORTS.includes(sort as ScreenerSort) ? (sort as ScreenerSort) : "rank",
    dir: params.get("dir") === "desc" ? "desc" : "asc",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : 50,
  };
}

export function sortValue(coin: ScreenerCoin, sort: ScreenerSort): number | null {
  switch (sort) {
    case "rank": return coin.rank;
    case "price": return coin.priceUsd;
    case "d1h": return coin.change1hPct;
    case "d24h": return coin.change24hPct;
    case "d7d": return coin.change7dPct;
    case "d30d": return coin.change30dPct;
    case "mcap": return coin.marketCapUsd;
    case "volume": return coin.volume24hUsd;
    case "ath": return coin.athDrawdownPct;
  }
}

/**
 * Relevancia de una búsqueda: 0 símbolo exacto, 1 símbolo que empieza igual,
 * 2 nombre que empieza igual, 3 coincidencia parcial. null si no coincide.
 */
export function matchScore(coin: ScreenerCoin, q: string): number | null {
  if (!q) return 0;
  const symbol = coin.symbol.toLowerCase();
  const name = coin.name.toLowerCase();
  if (symbol === q) return 0;
  if (symbol.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (name.includes(q) || symbol.includes(q) || coin.id.includes(q)) return 3;
  return null;
}

/** Los valores faltantes van siempre al final, en cualquier dirección. */
function compareBy(sort: ScreenerSort, dir: SortDir) {
  return (a: ScreenerCoin, b: ScreenerCoin) => {
    const va = sortValue(a, sort);
    const vb = sortValue(b, sort);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return dir === "asc" ? va - vb : vb - va;
  };
}

export function queryScreener(coins: ScreenerCoin[], query: ScreenerQuery): ScreenerPage {
  const scored = coins.flatMap((coin) => {
    const score = matchScore(coin, query.q);
    return score === null ? [] : [{ coin, score }];
  });

  const byField = compareBy(query.sort, query.dir);
  // buscando con el orden por defecto manda la relevancia; si el usuario
  // eligió otra columna, se respeta su orden entre las coincidencias
  const relevance = query.q !== "" && query.sort === "rank";
  scored.sort((a, b) => (relevance && a.score !== b.score ? a.score - b.score : byField(a.coin, b.coin)));

  const total = scored.length;
  const pages = Math.max(1, Math.ceil(total / query.size));
  const page = Math.min(query.page, pages);
  const start = (page - 1) * query.size;
  return { rows: scored.slice(start, start + query.size).map((s) => s.coin), total, page, pages };
}

const IMAGE_HOSTS = new Set(["coin-images.coingecko.com", "assets.coingecko.com"]);

/** Miniatura de 25px en vez del logo grande; solo desde el CDN de CoinGecko. */
export function thumbUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !IMAGE_HOSTS.has(parsed.hostname)) return null;
    parsed.pathname = parsed.pathname.replace("/large/", "/thumb/");
    return parsed.toString();
  } catch {
    return null;
  }
}
