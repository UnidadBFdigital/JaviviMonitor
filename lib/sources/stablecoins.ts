// Stablecoins — API pública de DeFiLlama (stablecoins.llama.fi), sin key.

import { cached } from "@/lib/cache";
import { getOfficialStablecoinMarket } from "./defillamaDashboard";
import type { SourceResult } from "./types";

const BASE = "https://stablecoins.llama.fi";
export const SOURCE = "DeFiLlama Stablecoins";

export type Stablecoin = {
  /** id de DeFiLlama: habilita pedir el histórico de esa moneda */
  id: string;
  name: string;
  symbol: string;
  pegMechanism: string;
  circulatingUsd: number;
  change7dPct: number | null;
  chains: { chain: string; circulatingUsd: number }[]; // top 6
};

export type ChainStablecoinSupply = {
  chain: string;
  circulatingUsd: number;
  assets: number;
};

type RawStable = {
  id: string;
  name: string;
  symbol: string;
  pegMechanism?: string;
  circulating?: { peggedUSD?: number };
  circulatingPrevWeek?: { peggedUSD?: number };
  chainCirculating?: Record<string, { current?: { peggedUSD?: number } }>;
};

export async function getStablecoins(limit = 10): Promise<SourceResult<Stablecoin[]>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "stablecoins:list",
      async () => {
        const res = await fetch(`${BASE}/stablecoins?includePrices=false`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`${SOURCE} /stablecoins → HTTP ${res.status}`);
        const json = (await res.json()) as { peggedAssets?: RawStable[] };
        return json.peggedAssets ?? [];
      },
      60 * 60 * 1000
    );
    const coins = data
      .map((s) => {
        const now = s.circulating?.peggedUSD ?? 0;
        const prev = s.circulatingPrevWeek?.peggedUSD;
        const chains = Object.entries(s.chainCirculating ?? {})
          .map(([chain, v]) => ({ chain, circulatingUsd: v.current?.peggedUSD ?? 0 }))
          .filter((c) => c.circulatingUsd > 0)
          .sort((a, b) => b.circulatingUsd - a.circulatingUsd)
          .slice(0, 6);
        return {
          id: String(s.id),
          name: s.name,
          symbol: s.symbol,
          pegMechanism: s.pegMechanism ?? "—",
          circulatingUsd: now,
          change7dPct: prev && prev > 0 ? ((now - prev) / prev) * 100 : null,
          chains,
        };
      })
      .filter((s) => s.circulatingUsd > 0)
      .sort((a, b) => b.circulatingUsd - a.circulatingUsd)
      .slice(0, limit);
    return { ok: true, data: coins, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- Histórico de supply por moneda y por red ---

type RawSupplyChartPoint = {
  date: string | number;
  totalCirculatingUSD?: { peggedUSD?: number };
};

async function supplyChart(path: string, cacheKey: string): Promise<SourceResult<SupplyPoint[]>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      cacheKey,
      async () => {
        const res = await fetch(`${BASE}${path}`, {
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`${SOURCE} ${path} → HTTP ${res.status}`);
        const json = (await res.json()) as RawSupplyChartPoint[];
        return json
          .map((p) => ({
            date: new Date(Number(p.date) * 1000).toISOString().slice(0, 10),
            totalUsd: Number(p.totalCirculatingUSD?.peggedUSD),
          }))
          .filter((p) => Number.isFinite(p.totalUsd) && p.totalUsd >= 0)
          .sort((a, b) => a.date.localeCompare(b.date));
      },
      6 * 60 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

/** Supply circulante histórico de una stablecoin, desde su lanzamiento. */
export async function getStablecoinSupplyHistory(id: string): Promise<SourceResult<SupplyPoint[]>> {
  if (!/^\d{1,6}$/.test(id)) return { ok: false, source: SOURCE, error: "id de stablecoin inválido" };
  return supplyChart(`/stablecoincharts/all?stablecoin=${id}`, `stablecoins:history:${id}`);
}

/**
 * Supply histórico de stablecoins atadas al dólar en una red. Usa solo
 * `peggedUSD`, igual que el desglose por red de la tarjeta de supply: sumar
 * euros o yenes mezclaría otra demanda.
 */
export async function getChainStablecoinHistory(chain: string): Promise<SourceResult<SupplyPoint[]>> {
  if (!/^[A-Za-z0-9 ._()-]{1,40}$/.test(chain)) {
    return { ok: false, source: SOURCE, error: "red inválida" };
  }
  return supplyChart(`/stablecoincharts/${encodeURIComponent(chain)}`, `stablecoins:chainHistory:${chain}`);
}

/**
 * Oferta de stablecoins agregada por red. Es una señal de capital transaccional
 * distinta del TVL: resulta especialmente útil para redes orientadas a pagos.
 */
export async function getStablecoinSupplyByChain(): Promise<SourceResult<ChainStablecoinSupply[]>> {
  const total = await getStablecoinTotal();
  if (!total.ok) return total;
  return {
    ok: true,
    data: total.data.byChain.map((row) => ({ ...row, assets: 0 })),
    source: total.source,
    fetchedAt: total.fetchedAt,
    stale: total.stale,
  };
}

// --- Supply histórico por emisor (para el área apilada) ---

export type IssuerSupplyPoint = { date: string } & Record<string, number | string>;

type RawIssuerPoint = { date: string; totalCirculatingUSD?: { peggedUSD?: number } };

// ids de DeFiLlama para los principales emisores (estables en el tiempo)
const TOP_ISSUERS: { id: number; symbol: string }[] = [
  { id: 1, symbol: "USDT" },
  { id: 2, symbol: "USDC" },
  { id: 209, symbol: "USDS" },
  { id: 5, symbol: "DAI" },
  { id: 146, symbol: "USDe" },
];

export async function getSupplyByIssuer(
  days = 180
): Promise<SourceResult<{ series: IssuerSupplyPoint[]; issuers: string[] }>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      `stablecoins:by-issuer:${days}`,
      async () => {
        const results = await Promise.allSettled(
          TOP_ISSUERS.map(async (iss) => {
            const res = await fetch(`${BASE}/stablecoincharts/all?stablecoin=${iss.id}`, {
              cache: "no-store",
              headers: { accept: "application/json" },
            });
            if (!res.ok) throw new Error(`${SOURCE} ${iss.symbol} → HTTP ${res.status}`);
            const json = (await res.json()) as RawIssuerPoint[];
            return {
              symbol: iss.symbol,
              points: json.slice(-days).map((p) => ({
                date: new Date(Number(p.date) * 1000).toISOString().slice(0, 10),
                value: p.totalCirculatingUSD?.peggedUSD ?? 0,
              })),
            };
          })
        );
        const ok = results
          .filter(
            (r): r is PromiseFulfilledResult<{ symbol: string; points: { date: string; value: number }[] }> =>
              r.status === "fulfilled"
          )
          .map((r) => r.value);
        if (ok.length === 0) throw new Error("ningún emisor respondió");

        // fechas comunes: partimos del emisor con la serie más corta
        const dateSets = ok.map((o) => new Set(o.points.map((p) => p.date)));
        const dates = ok[0].points
          .map((p) => p.date)
          .filter((d) => dateSets.every((s) => s.has(d)))
          .sort();
        const byIssuer = new Map(
          ok.map((o) => [o.symbol, new Map(o.points.map((p) => [p.date, p.value]))])
        );
        const series: IssuerSupplyPoint[] = dates.map((date) => {
          const row: IssuerSupplyPoint = { date };
          for (const o of ok) row[o.symbol] = byIssuer.get(o.symbol)!.get(date) ?? 0;
          return row;
        });
        return { series, issuers: ok.map((o) => o.symbol) };
      },
      60 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

export type SupplyPoint = { date: string; totalUsd: number };

export async function getSupplyHistory(days = 365): Promise<SourceResult<SupplyPoint[]>> {
  const market = await getOfficialStablecoinMarket();
  if (!market.ok) return market;
  return {
    ok: true,
    data: market.data.history.slice(-Math.max(7, Math.min(days, 3650))),
    source: market.source,
    fetchedAt: market.fetchedAt,
    stale: market.stale,
  };
}

/** Stablecoins concretas por símbolo, sin depender de que entren en el top N.
 *  RLUSD, PYUSD y FDUSD quedan fuera de los primeros puestos pero son las que
 *  importan para la tesis institucional. */
export async function getStablecoinsBySymbol(
  symbols: string[]
): Promise<SourceResult<Stablecoin[]>> {
  const all = await getStablecoins(400);
  if (!all.ok) return all;
  const wanted = symbols.map((s) => s.toUpperCase());
  const found = wanted.flatMap((sym) => {
    const hit = all.data.find((s) => s.symbol.toUpperCase() === sym);
    return hit ? [hit] : [];
  });
  return { ...all, data: found };
}

// --- Total canónico y reparto por red ---
//
// La cifra canónica se lee del resumen estructurado de la página oficial. No
// se suma /stablecoincharts/all: ese endpoint incluye wrappers marcados como
// doublecounted y reporta supply bruto, por eso queda varios miles de millones
// por encima del market cap visible en defillama.com/stablecoins.
//
// Regla del terminal: cualquier lugar que diga "supply total de stablecoins"
// lee ESTA función. Sumar los top-N emisores da otro número y no es un total.

export type ChainSupply = { chain: string; circulatingUsd: number };

export type StablecoinTotal = {
  totalUsd: number;
  byChain: ChainSupply[];
  chainCount: number;
  attributedUsd: number;
  chainCoveragePct: number;
  chainBreakdownAvailable: boolean;
  change1dPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  dominantSymbol: string | null;
  dominancePct: number | null;
  dataTimestamp: string;
  methodology: string;
};

type RawChainSupply = { name: string; totalCirculatingUSD?: { peggedUSD?: number } };

export async function getStablecoinTotal(): Promise<SourceResult<StablecoinTotal>> {
  const market = await getOfficialStablecoinMarket();
  if (!market.ok) return market;

  let byChain: ChainSupply[] = [];
  let chainStale = false;
  try {
    const chainResult = await cached(
      "stablecoins:chains",
      async () => {
        const res = await fetch(`${BASE}/stablecoinchains`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`${SOURCE} /stablecoinchains → HTTP ${res.status}`);
        return res.json() as Promise<RawChainSupply[]>;
      },
      60 * 60 * 1000
    );
    chainStale = chainResult.stale;
    byChain = chainResult.data
      .map((chain) => ({
        chain: chain.name,
        circulatingUsd: chain.totalCirculatingUSD?.peggedUSD ?? 0,
      }))
      .filter((chain) => chain.circulatingUsd > 0)
      .sort((a, b) => b.circulatingUsd - a.circulatingUsd);
  } catch {
    // El total oficial sigue siendo válido aunque el desglose auxiliar falle.
  }

  const attributedUsd = byChain.reduce((sum, chain) => sum + chain.circulatingUsd, 0);
  return {
    ok: true,
    data: {
      totalUsd: market.data.totalUsd,
      byChain,
      chainCount: byChain.length,
      attributedUsd,
      chainCoveragePct:
        market.data.totalUsd > 0 ? (attributedUsd / market.data.totalUsd) * 100 : 0,
      chainBreakdownAvailable: byChain.length > 0,
      change1dPct: market.data.change1dPct,
      change7dPct: market.data.change7dPct,
      change30dPct: market.data.change30dPct,
      dominantSymbol: market.data.dominantSymbol,
      dominancePct: market.data.dominancePct,
      dataTimestamp: market.data.dataTimestamp,
      methodology: market.data.methodology,
    },
    source: byChain.length > 0 ? `${market.source} + Stablecoins API` : market.source,
    fetchedAt: market.fetchedAt,
    stale: market.stale || chainStale,
  };
}
