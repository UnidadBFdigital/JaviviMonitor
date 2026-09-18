// DeFiLlama Yields (yields.llama.fi) — gratis, sin API key.
//
// /pools        rendimiento actual de ~16.000 pools, se reduce al universo útil
// /lendBorrow   tasa de préstamo, utilización y LTV de los mercados de lending
// /chart/{pool} histórico diario de APY y TVL de un pool
//
// La tasa histórica de préstamo (/chartLendBorrow) y /poolsBorrow son de pago:
// la ficha muestra la tasa actual y lo declara, no la reconstruye.

import { cached } from "@/lib/cache";
import { buildUniverse, type ProtocolInfo, type RawLendBorrow, type RawYieldPool, type YieldPool } from "@/lib/yields";
import type { SourceResult } from "./types";

const BASE = "https://yields.llama.fi";
export const SOURCE = "DeFiLlama Yields";
export const SOURCE_URL = "https://defillama.com/yields";

async function fetchJson<T>(url: string, timeoutMs = 30_000): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${SOURCE} ${new URL(url).pathname} → HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

type RawProtocol = { slug?: unknown; name?: unknown; category?: unknown };

/**
 * Nombre y categoría de cada protocolo. Comparte la entrada de caché con el
 * resto del terminal: /protocols se descarga una vez para todas las vistas.
 */
async function protocolDirectory(): Promise<Map<string, ProtocolInfo>> {
  const { data } = await cached("defillama:protocols", () => fetchJson<RawProtocol[]>("https://api.llama.fi/protocols"));
  const map = new Map<string, ProtocolInfo>();
  for (const p of Array.isArray(data) ? data : []) {
    if (typeof p.slug !== "string" || typeof p.name !== "string") continue;
    map.set(p.slug, { name: p.name, category: typeof p.category === "string" ? p.category : null });
  }
  return map;
}

export type YieldUniverse = {
  pools: YieldPool[];
  /** pools con más de $100k que hoy no pagan rendimiento (colateral, vaults CDP) */
  withoutYield: number;
  /** pools publicados por la fuente antes de filtrar */
  published: number;
  /** false si /lendBorrow no respondió: los préstamos quedan sin tasa */
  borrowRates: boolean;
};

export async function getYieldUniverse(): Promise<SourceResult<YieldUniverse>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "defillama:yields:universe:v1",
      async () => {
        // las tasas de préstamo son un complemento: un reintento, y si igual fallan el universo sale sin ellas
        const lendBorrow = () => fetchJson<RawLendBorrow[]>(`${BASE}/lendBorrow`);
        const [pools, lend, directory] = await Promise.all([
          fetchJson<{ data?: RawYieldPool[] }>(`${BASE}/pools`, 45_000),
          lendBorrow().catch(() => lendBorrow()).catch(() => null),
          protocolDirectory().catch(() => new Map<string, ProtocolInfo>()),
        ]);
        const raws = Array.isArray(pools.data) ? pools.data : [];
        if (raws.length === 0) throw new Error(`${SOURCE} /pools → sin pools`);
        const lendMap = new Map<string, RawLendBorrow>();
        for (const row of Array.isArray(lend) ? lend : []) {
          if (typeof row.pool === "string") lendMap.set(row.pool, row);
        }
        const { pools: universe, withoutYield } = buildUniverse(raws, directory, lendMap);
        return { pools: universe, withoutYield, published: raws.length, borrowRates: lend !== null };
      },
      // sin tasas de préstamo el universo vence antes, para recuperarlas pronto
      (universe) => (universe.borrowRates ? 30 * 60 * 1000 : 5 * 60 * 1000),
      { failureTtlMs: 5 * 60 * 1000 }
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (error) {
    return { ok: false, source: SOURCE, error: String(error) };
  }
}

export type PoolChartPoint = {
  date: string;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  tvlUsd: number | null;
};

type RawChartPoint = { timestamp?: unknown; apy?: unknown; apyBase?: unknown; apyReward?: unknown; tvlUsd?: unknown };

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Histórico diario de un pool. El último punto intradía reemplaza al del mismo día. */
export async function getPoolChart(poolId: string): Promise<SourceResult<PoolChartPoint[]>> {
  if (!/^[A-Za-z0-9-]{8,80}$/.test(poolId)) return { ok: false, source: SOURCE, error: "id de pool inválido" };
  try {
    const { data, fetchedAt, stale } = await cached(
      `defillama:yields:chart:${poolId}`,
      async () => {
        const json = await fetchJson<{ data?: RawChartPoint[] }>(`${BASE}/chart/${poolId}`);
        const byDay = new Map<string, PoolChartPoint>();
        for (const raw of Array.isArray(json.data) ? json.data : []) {
          if (typeof raw.timestamp !== "string") continue;
          const time = Date.parse(raw.timestamp);
          if (!Number.isFinite(time)) continue;
          const date = new Date(time).toISOString().slice(0, 10);
          byDay.set(date, { date, apy: num(raw.apy), apyBase: num(raw.apyBase), apyReward: num(raw.apyReward), tvlUsd: num(raw.tvlUsd) });
        }
        return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
      },
      60 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (error) {
    return { ok: false, source: SOURCE, error: String(error) };
  }
}
