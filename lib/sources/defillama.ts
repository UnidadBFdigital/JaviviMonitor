// Módulo DeFiLlama (api.llama.fi) — gratis, sin API key.
// Patrón de referencia para todos los módulos de la Fase 2.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

const BASE = "https://api.llama.fi";
export const SOURCE = "DeFiLlama";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    // el cache propio (lib/cache) maneja el TTL; acá siempre vamos a red
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${SOURCE} ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// --- TVL por protocolo (top N) ---

export type ProtocolTvl = {
  name: string;
  slug: string;
  category: string;
  chain: string;
  tvlUsd: number;
  change1dPct: number | null;
  change7dPct: number | null;
};

type RawProtocol = {
  name: string;
  slug: string;
  category: string;
  chain: string;
  tvl: number | null;
  change_1d: number | null;
  change_7d: number | null;
};

/**
 * Índice de protocolos, recortado antes de entrar a la caché.
 *
 * /protocols devuelve 8,5 MB con decenas de campos por protocolo y la app usa
 * siete. Guardar la respuesta entera costaba esos 8,5 MB en memoria y otro
 * tanto en la copia en disco, y cada lectura recorría objetos gigantes. Acá se
 * recorta una vez, al traerlo: lo que queda cacheado es ~3% de lo que llega.
 *
 * Es la única puerta a esta clave: el módulo de yields también la usa para su
 * directorio de protocolos, así que una sola definición evita que dos copias
 * de la misma clave guarden formas distintas.
 */
export function protocolsIndex() {
  return cached("defillama:protocols:v2", async () => {
    const raw = await fetchJson<Partial<RawProtocol>[]>("/protocols");
    const slim: RawProtocol[] = [];
    for (const p of Array.isArray(raw) ? raw : []) {
      if (typeof p.name !== "string" || typeof p.slug !== "string") continue;
      slim.push({
        name: p.name,
        slug: p.slug,
        category: typeof p.category === "string" ? p.category : "—",
        chain: typeof p.chain === "string" ? p.chain : "—",
        tvl: typeof p.tvl === "number" ? p.tvl : null,
        change_1d: typeof p.change_1d === "number" ? p.change_1d : null,
        change_7d: typeof p.change_7d === "number" ? p.change_7d : null,
      });
    }
    if (slim.length === 0) throw new Error(`${SOURCE} /protocols → sin protocolos`);
    return slim;
  });
}

export async function getTopProtocols(
  limit = 10
): Promise<SourceResult<ProtocolTvl[]>> {
  try {
    const { data, fetchedAt, stale } = await protocolsIndex();
    const top = data
      // los CEX aparecen en /protocols pero no son protocolos DeFi
      .filter((p) => p.category !== "CEX")
      .filter((p) => typeof p.tvl === "number" && p.tvl! > 0)
      .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
      .slice(0, limit)
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        category: p.category,
        chain: p.chain,
        tvlUsd: p.tvl as number,
        change1dPct: p.change_1d,
        change7dPct: p.change_7d,
      }));
    return { ok: true, data: top, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- Ranking de crecimiento/caída (7d) ---

export type Movers = { gainers: ProtocolTvl[]; losers: ProtocolTvl[] };

export async function getMovers(count = 5): Promise<SourceResult<Movers>> {
  try {
    const { data, fetchedAt, stale } = await protocolsIndex();
    // solo protocolos con TVL relevante para evitar ruido de micro-caps
    const eligible = data
      .filter((p) => p.category !== "CEX")
      .filter((p) => (p.tvl ?? 0) > 50_000_000 && typeof p.change_7d === "number")
      // cambios de miles de % son listados nuevos o datos rotos, no señal
      .filter((p) => Math.abs(p.change_7d as number) < 500)
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        category: p.category,
        chain: p.chain,
        tvlUsd: p.tvl as number,
        change1dPct: p.change_1d,
        change7dPct: p.change_7d,
      }))
      .sort((a, b) => (b.change7dPct ?? 0) - (a.change7dPct ?? 0));
    return {
      ok: true,
      data: { gainers: eligible.slice(0, count), losers: eligible.slice(-count).reverse() },
      source: SOURCE,
      fetchedAt,
      stale,
    };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- Revenue por protocolo ---

export type ProtocolRevenue = {
  name: string;
  slug: string;
  category: string;
  revenue24hUsd: number;
  revenue7dUsd: number | null;
  revenue30dUsd: number | null;
};

type RawFeesOverview = {
  protocols: {
    name: string;
    slug?: string;
    category?: string;
    total24h?: number | null;
    total7d?: number | null;
    total30d?: number | null;
  }[];
};

export async function getProtocolRevenue(
  limit = 10
): Promise<SourceResult<ProtocolRevenue[]>> {
  try {
    // la respuesta trae 3,8 MB; de cada protocolo se guardan cinco campos
    const { data, fetchedAt, stale } = await cached("defillama:revenue:v2", async () => {
      const raw = await fetchJson<RawFeesOverview>(
        "/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue"
      );
      return (raw.protocols ?? [])
        .filter((p) => typeof p.name === "string" && typeof p.total24h === "number")
        .map((p) => ({
          name: p.name,
          slug: p.slug,
          category: p.category,
          total24h: p.total24h,
          total7d: p.total7d,
          total30d: p.total30d,
        }));
    });
    const top = data
      .filter((p) => typeof p.total24h === "number" && p.total24h! > 0)
      .sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
      .slice(0, limit)
      .map((p) => ({
        name: p.name,
        slug: p.slug ?? p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        category: p.category ?? "—",
        revenue24hUsd: p.total24h as number,
        revenue7dUsd: p.total7d ?? null,
        revenue30dUsd: p.total30d ?? null,
      }));
    return { ok: true, data: top, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- Estado de resultados por protocolo ---

type FeeDimension =
  | "dailyFees"
  | "dailySupplySideRevenue"
  | "dailyRevenue"
  | "dailyHoldersRevenue"
  | "dailyProtocolRevenue";

type RawFeeSummary = {
  name?: string;
  displayName?: string;
  slug?: string;
  category?: string;
  total24h?: number | null;
  total7d?: number | null;
  total30d?: number | null;
  total1y?: number | null;
  totalAllTime?: number | null;
};

export type IncomeStatementLine = {
  key: FeeDimension;
  label: string;
  role: "gross" | "cost" | "profit" | "allocation";
  value24hUsd: number | null;
  value7dUsd: number | null;
  value30dUsd: number | null;
  value1yUsd: number | null;
  allTimeUsd: number | null;
  definition: string;
};

export type ProtocolIncomeStatement = {
  protocol: string;
  name: string;
  category: string;
  lines: IncomeStatementLine[];
  grossMargin30dPct: number | null;
  annualizedRevenueUsd: number | null;
  methodologyUrl: string;
};

const INCOME_DIMENSIONS: {
  key: FeeDimension;
  label: string;
  role: IncomeStatementLine["role"];
  definition: string;
}[] = [
  {
    key: "dailyFees",
    label: "Ingresos brutos (fees)",
    role: "gross",
    definition: "Total pagado por los usuarios para utilizar el protocolo.",
  },
  {
    key: "dailySupplySideRevenue",
    label: "Costo del lado de oferta",
    role: "cost",
    definition: "Parte pagada a LPs, prestamistas, validadores u otros proveedores.",
  },
  {
    key: "dailyRevenue",
    label: "Beneficio bruto (revenue)",
    role: "profit",
    definition: "Parte de los fees que retiene el protocolo despues de costos de oferta.",
  },
  {
    key: "dailyHoldersRevenue",
    label: "Ingreso a tokenholders",
    role: "allocation",
    definition: "Valor distribuido a holders mediante pagos, staking, recompras o quema.",
  },
  {
    key: "dailyProtocolRevenue",
    label: "Ingreso del protocolo",
    role: "allocation",
    definition: "Parte del revenue asignada al equipo o a la tesoreria del protocolo.",
  },
];

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getProtocolIncomeStatement(
  protocol: string
): Promise<SourceResult<ProtocolIncomeStatement>> {
  const safeProtocol = protocol.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(safeProtocol)) {
    return { ok: false, source: SOURCE, error: "Slug de protocolo invalido" };
  }

  try {
    const { data, fetchedAt, stale } = await cached(
      `defillama:income-statement:${safeProtocol}:v1`,
      async () => {
        const settled = await Promise.allSettled(
          INCOME_DIMENSIONS.map(async (dimension) => ({
            dimension,
            summary: await fetchJson<RawFeeSummary>(
              `/summary/fees/${encodeURIComponent(safeProtocol)}?dataType=${dimension.key}&excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`
            ),
          }))
        );
        const available = settled.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : []
        );
        if (!available.some((item) => item.dimension.key === "dailyFees")) {
          throw new Error(`${SOURCE} no tiene fees para ${safeProtocol}`);
        }

        const identity = available[0].summary;
        const lines = INCOME_DIMENSIONS.map((dimension) => {
          const summary = available.find((item) => item.dimension.key === dimension.key)?.summary;
          return {
            ...dimension,
            value24hUsd: finiteOrNull(summary?.total24h),
            value7dUsd: finiteOrNull(summary?.total7d),
            value30dUsd: finiteOrNull(summary?.total30d),
            value1yUsd: finiteOrNull(summary?.total1y),
            allTimeUsd: finiteOrNull(summary?.totalAllTime),
          } satisfies IncomeStatementLine;
        });

        const fees30d = lines.find((line) => line.key === "dailyFees")?.value30dUsd ?? null;
        const revenue30d =
          lines.find((line) => line.key === "dailyRevenue")?.value30dUsd ?? null;
        return {
          protocol: identity.slug ?? safeProtocol,
          name: identity.displayName ?? identity.name ?? safeProtocol,
          category: identity.category ?? "—",
          lines,
          grossMargin30dPct:
            fees30d !== null && fees30d > 0 && revenue30d !== null
              ? (revenue30d / fees30d) * 100
              : null,
          annualizedRevenueUsd: revenue30d !== null ? revenue30d * (365 / 30) : null,
          methodologyUrl: "https://defillama.com/data-definitions",
        } satisfies ProtocolIncomeStatement;
      },
      30 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (error) {
    return { ok: false, source: SOURCE, error: String(error) };
  }
}

// --- Volumen DEX agregado ---

export type DexOverview = {
  total24hUsd: number;
  change7dPct: number | null;
  topDexs: { name: string; volume24hUsd: number }[];
};

type RawDexOverview = {
  total24h?: number;
  change_7dover7d?: number;
  protocols?: { name: string; total24h?: number | null }[];
};

export async function getDexOverview(): Promise<SourceResult<DexOverview>> {
  try {
    // 1,8 MB de los que solo se usan dos totales y el ranking corto
    const { data, fetchedAt, stale } = await cached("defillama:dex-overview:v2", async () => {
      const raw = await fetchJson<RawDexOverview>(
        "/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true"
      );
      return {
        total24h: raw.total24h,
        change_7dover7d: raw.change_7dover7d,
        protocols: (raw.protocols ?? [])
          .filter((p) => typeof p.name === "string" && typeof p.total24h === "number")
          .sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
          .slice(0, 20)
          .map((p) => ({ name: p.name, total24h: p.total24h })),
      };
    });
    return {
      ok: true,
      data: {
        total24hUsd: data.total24h ?? 0,
        change7dPct: data.change_7dover7d ?? null,
        topDexs: (data.protocols ?? [])
          .filter((p) => typeof p.total24h === "number" && p.total24h! > 0)
          .sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
          .slice(0, 8)
          .map((p) => ({ name: p.name, volume24hUsd: p.total24h as number })),
      },
      source: SOURCE,
      fetchedAt,
      stale,
    };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- TVL por chain ---

export type ChainTvl = { name: string; tvlUsd: number };

type RawChain = { name: string; tvl: number | null; gecko_id?: string | null; tokenSymbol?: string | null };

export type ChainToken = { geckoId: string | null; symbol: string | null };

/**
 * Token asociado a una red en DeFiLlama (id de CoinGecko y símbolo). Reusa la
 * misma respuesta cacheada de /v2/chains: no agrega llamadas. Redes sin token
 * propio (Base, por ejemplo) devuelven ok con geckoId null.
 */
export async function getChainToken(chain: string): Promise<SourceResult<ChainToken>> {
  try {
    const { data, fetchedAt, stale } = await cached("defillama:chains", () =>
      fetchJson<RawChain[]>("/v2/chains")
    );
    const match = data.find((c) => c.name.toLowerCase() === chain.toLowerCase());
    if (!match) return { ok: false, source: SOURCE, error: `red no encontrada: ${chain}` };
    return {
      ok: true,
      data: { geckoId: geckoIdOf(match.gecko_id), symbol: symbolOf(match.tokenSymbol) },
      source: SOURCE,
      fetchedAt,
      stale,
    };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

/** Todas las chains con TVL > 0 — el BBIM necesita cruzar redes concretas,
 *  no solo el top. Comparte cache con getChainsTvl. */
export async function getAllChainsTvl(): Promise<SourceResult<ChainTvl[]>> {
  try {
    const { data, fetchedAt, stale } = await cached("defillama:chains", () =>
      fetchJson<RawChain[]>("/v2/chains")
    );
    const all = data
      .filter((c) => typeof c.tvl === "number" && c.tvl! > 0)
      .map((c) => ({ name: c.name, tvlUsd: c.tvl as number }));
    return { ok: true, data: all, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

export async function getChainsTvl(limit = 15): Promise<SourceResult<ChainTvl[]>> {
  try {
    const { data, fetchedAt, stale } = await cached("defillama:chains", () =>
      fetchJson<RawChain[]>("/v2/chains")
    );
    const top = data
      .filter((c) => typeof c.tvl === "number" && c.tvl! > 0)
      .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
      .slice(0, limit)
      .map((c) => ({ name: c.name, tvlUsd: c.tvl as number }));
    return { ok: true, data: top, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- TVL total histórico (todas las chains) ---

export type TvlPoint = { date: string; tvlUsd: number }; // date: YYYY-MM-DD

type RawTvlPoint = { date: number; tvl: number };

export async function getTvlHistory(
  days = 365
): Promise<SourceResult<TvlPoint[]>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "defillama:historicalChainTvl",
      () => fetchJson<RawTvlPoint[]>("/v2/historicalChainTvl")
    );
    const points = data.slice(-days).map((p) => ({
      date: new Date(p.date * 1000).toISOString().slice(0, 10),
      tvlUsd: p.tvl,
    }));
    return { ok: true, data: points, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- TVL histórico por cadena ---

/**
 * Serie diaria de TVL de UNA cadena. Complementa a `getTvlHistory`, que
 * agrega todas: el módulo de infraestructura necesita comparar la trayectoria
 * de cada red por separado, incluidas las que no cubre growthepie.
 */
export async function getChainTvlHistory(
  chain: string,
  days = 365
): Promise<SourceResult<TvlPoint[]>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      `defillama:chainTvl:${chain}`,
      () => fetchJson<RawTvlPoint[]>(`/v2/historicalChainTvl/${encodeURIComponent(chain)}`),
      6 * 60 * 60 * 1000
    );
    const points = data.slice(-days).map((p) => ({
      date: new Date(p.date * 1000).toISOString().slice(0, 10),
      tvlUsd: p.tvl,
    }));
    return { ok: true, data: points, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- TVL histórico por protocolo ---

export type ProtocolHistory = {
  name: string;
  url: string | null;
  /** id de CoinGecko del token del protocolo, si DeFiLlama lo asocia */
  geckoId: string | null;
  symbol: string | null;
  points: TvlPoint[];
};

type RawProtocolDetail = {
  name?: string;
  url?: string;
  gecko_id?: string | null;
  symbol?: string | null;
  tvl?: { date: number; totalLiquidityUSD: number }[];
};

/** DeFiLlama usa "-" o vacío para "sin token"; un id fuera de formato no se usa. */
function geckoIdOf(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9-]{1,80}$/.test(value) ? value : null;
}

function symbolOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" && value !== "-" ? value.trim() : null;
}

/**
 * Serie diaria de TVL de un protocolo. El detalle de DeFiLlama pesa varios MB
 * (tokens por red, tesorería…): se cachea solo la serie ya reducida, nunca el
 * payload crudo. El último punto llega intradía y se consolida por fecha.
 */
export async function getProtocolTvlHistory(slug: string): Promise<SourceResult<ProtocolHistory>> {
  if (!/^[a-z0-9.-]{1,80}$/.test(slug)) {
    return { ok: false, source: SOURCE, error: "slug de protocolo inválido" };
  }
  try {
    const { data, fetchedAt, stale } = await cached(
      // v2: la entrada guarda también el token, para el precio en la ficha
      `defillama:protocolTvl:v2:${slug}`,
      async () => {
        const raw = await fetchJson<RawProtocolDetail>(`/protocol/${slug}`);
        const byDay = new Map<string, { time: number; value: number }>();
        for (const point of raw.tvl ?? []) {
          const time = Number(point.date) * 1000;
          const value = Number(point.totalLiquidityUSD);
          if (!Number.isFinite(time) || !Number.isFinite(value) || value < 0) continue;
          const date = new Date(time).toISOString().slice(0, 10);
          const previous = byDay.get(date);
          if (!previous || time >= previous.time) byDay.set(date, { time, value });
        }
        return {
          name: raw.name ?? slug,
          url: raw.url ?? null,
          geckoId: geckoIdOf(raw.gecko_id),
          symbol: symbolOf(raw.symbol),
          points: [...byDay.entries()]
            .map(([date, p]) => ({ date, tvlUsd: p.value }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        };
      },
      6 * 60 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- RWA: activos del mundo real tokenizados ---

// DeFiLlama clasifica RWA en dos categorías: "RWA" (el grueso: treasuries,
// oro, acciones, inmuebles) y "RWA Lending" (crédito privado on-chain).
// Se leen las dos y se conserva la categoría cruda para poder distinguirlas.
const RWA_CATEGORIES = ["RWA", "RWA Lending"];

export async function getRwaProtocols(): Promise<SourceResult<ProtocolTvl[]>> {
  try {
    const { data, fetchedAt, stale } = await protocolsIndex();
    const rwa = data
      .filter((p) => RWA_CATEGORIES.includes(p.category))
      .filter((p) => typeof p.tvl === "number" && p.tvl! > 0)
      .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        category: p.category,
        chain: p.chain,
        tvlUsd: p.tvl as number,
        change1dPct: p.change_1d,
        change7dPct: p.change_7d,
      }));
    return { ok: true, data: rwa, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
