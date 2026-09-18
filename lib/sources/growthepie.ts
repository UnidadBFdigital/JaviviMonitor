import { cached } from "@/lib/cache";
import { observableNumber } from "@/lib/bbiMethodology";
import type { SourceResult } from "./types";

// growthepie — la única fuente pública que publica costo MEDIANO por
// transacción en USD con serie diaria, además de throughput observado,
// txcount y direcciones activas con una metodología homogénea.
//
// Cubre Ethereum y su ecosistema (L2 + Polygon PoS + Celo + Starknet…).
// NO cubre Solana, BNB, Avalanche, Sui, Aptos, NEAR ni Tron: para esas redes
// el módulo publica N/A en costo, nunca un número traído de otra metodología.

const BASE = "https://api.growthepie.xyz/v1";

export const SOURCE = "growthepie";
export const SOURCE_URL = "https://growthepie.xyz/";

/** Métricas del endpoint de fundamentals que consume el módulo. */
export const GP_METRICS = [
  "txcosts_median_usd",
  "daa",
  "txcount",
  "gas_per_second",
  "fees_paid_usd",
  "stables_mcap",
  "tvl",
] as const;

export type GpMetric = (typeof GP_METRICS)[number];

export type GpPoint = { date: string; value: number };

/** origin_key → métrica → serie diaria ascendente por fecha. */
export type GpFundamentals = Record<string, Partial<Record<GpMetric, GpPoint[]>>>;

type RawRow = { metric_key?: unknown; origin_key?: unknown; date?: unknown; value?: unknown };

const WANTED = new Set<string>(GP_METRICS);

export function parseFundamentals(rows: RawRow[]): GpFundamentals {
  const out: GpFundamentals = {};
  for (const row of rows) {
    const metric = typeof row.metric_key === "string" ? row.metric_key : null;
    const origin = typeof row.origin_key === "string" ? row.origin_key : null;
    const date = typeof row.date === "string" ? row.date : null;
    const value = observableNumber(row.value);
    if (!metric || !origin || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || !WANTED.has(metric) || value === null) continue;
    // agregados del propio proveedor: no son una red comparable
    if (origin === "all_l2s" || origin === "multiple") continue;

    const chain = (out[origin] ??= {});
    const series = (chain[metric as GpMetric] ??= []);
    series.push({ date, value });
  }
  for (const chain of Object.values(out)) {
    for (const series of Object.values(chain)) {
      if (!series) continue;
      const unique = [...new Map(series.map((p) => [p.date, p])).values()];
      series.splice(0, series.length, ...unique.sort((a, b) => a.date.localeCompare(b.date)));
    }
  }
  return out;
}

/**
 * Serie diaria de los últimos ~90 días para todas las cadenas cubiertas.
 * El payload ronda los 4 MB, así que se cachea agresivamente: la fuente
 * publica una vez al día.
 */
export async function getGrowthepieFundamentals(): Promise<SourceResult<GpFundamentals>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "growthepie:fundamentals:v2",
      async () => {
        const response = await fetch(`${BASE}/fundamentals.json`, {
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) throw new Error(`${SOURCE} /fundamentals → HTTP ${response.status}`);
        return parseFundamentals((await response.json()) as RawRow[]);
      },
      6 * 60 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch {
    return { ok: false, source: SOURCE, error: "fundamentals no disponible" };
  }
}

export type GpChainMeta = {
  name: string;
  chainType: string | null;
  evmChainId: number | null;
  docs: string | null;
  github: string | null;
  website: string | null;
  explorers: { label: string; url: string }[];
  rpcs: { label: string; url: string }[];
};

type RawMaster = {
  chains?: Record<
    string,
    {
      name?: unknown;
      chain_type?: unknown;
      evm_chain_id?: unknown;
      links?: {
        website?: unknown;
        docs?: unknown;
        github?: unknown;
        block_explorers?: Record<string, unknown>;
        rpcs?: Record<string, unknown>;
      };
    }
  >;
  last_updated_utc?: unknown;
};

function linkList(raw: Record<string, unknown> | undefined): { label: string; url: string }[] {
  if (!raw) return [];
  return Object.entries(raw)
    .filter(([, url]) => typeof url === "string" && url.startsWith("http"))
    .map(([label, url]) => ({ label, url: url as string }));
}

/** Metadatos y enlaces oficiales por cadena: evita curar a mano lo que la fuente ya publica. */
export async function getGrowthepieMaster(): Promise<SourceResult<Record<string, GpChainMeta>>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "growthepie:master",
      async () => {
        const response = await fetch(`${BASE}/master.json`, {
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) throw new Error(`${SOURCE} /master → HTTP ${response.status}`);
        const raw = (await response.json()) as RawMaster;
        const out: Record<string, GpChainMeta> = {};
        for (const [key, chain] of Object.entries(raw.chains ?? {})) {
          out[key] = {
            name: typeof chain.name === "string" ? chain.name : key,
            chainType: typeof chain.chain_type === "string" ? chain.chain_type : null,
            evmChainId: typeof chain.evm_chain_id === "number" ? chain.evm_chain_id : null,
            docs: typeof chain.links?.docs === "string" ? chain.links.docs : null,
            github: typeof chain.links?.github === "string" ? chain.links.github : null,
            website: typeof chain.links?.website === "string" ? chain.links.website : null,
            explorers: linkList(chain.links?.block_explorers),
            rpcs: linkList(chain.links?.rpcs),
          };
        }
        return out;
      },
      24 * 60 * 60 * 1000
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch {
    return { ok: false, source: SOURCE, error: "master no disponible" };
  }
}
