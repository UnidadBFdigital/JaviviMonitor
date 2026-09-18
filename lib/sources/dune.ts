// Módulo Dune Analytics — requiere DUNE_API_KEY (tier gratuito).
// Lee el ÚLTIMO resultado de una query guardada (no dispara ejecución,
// que es lo que consume créditos fuerte). El costo es por filas leídas,
// por eso siempre pasamos ?limit=.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

const BASE = "https://api.dune.com/api/v1";
export const SOURCE = "Dune Analytics";

// Query pública de ejemplo de la doc oficial: volumen DEX.
// Reemplazable por queries propias guardadas en Dune.
const DEX_VOLUME_QUERY_ID = 3493826;

export type DuneRow = Record<string, string | number | null>;

export async function getQueryResults(
  queryId: number,
  limit = 10
): Promise<SourceResult<DuneRow[]>> {
  const apiKey = process.env.DUNE_API_KEY;
  if (!apiKey) {
    return { ok: false, source: SOURCE, error: "DUNE_API_KEY no configurada en .env.local" };
  }
  try {
    const { data, fetchedAt, stale } = await cached(
      `dune:query:${queryId}:${limit}`,
      async () => {
        const res = await fetch(`${BASE}/query/${queryId}/results?limit=${limit}`, {
          cache: "no-store",
          headers: { "X-DUNE-API-KEY": apiKey, accept: "application/json" },
        });
        if (!res.ok) throw new Error(`${SOURCE} query ${queryId} → HTTP ${res.status}`);
        const json = (await res.json()) as {
          result?: { rows?: DuneRow[] };
        };
        return json.result?.rows ?? [];
      }
      // TTL default 1h — los resultados de queries guardadas no cambian más rápido
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

export type DexTrade = {
  time: string;
  chain: string;
  project: string;
  pair: string;
  boughtAmount: number | null;
  boughtSymbol: string;
};

// La query de ejemplo devuelve trades DEX individuales con ~25 columnas;
// nos quedamos solo con lo legible. Al reemplazarla por una query propia,
// ajustar este mapeo a sus columnas.
export async function getDexTrades(limit = 8): Promise<SourceResult<DexTrade[]>> {
  const result = await getQueryResults(DEX_VOLUME_QUERY_ID, limit);
  if (!result.ok) return result;
  return {
    ...result,
    data: result.data.map((row) => ({
      time: String(row.block_time ?? "").replace(" UTC", ""),
      chain: String(row.blockchain ?? "—"),
      project: String(row.project ?? "—"),
      pair: String(row.token_pair ?? "—"),
      boughtAmount:
        typeof row.token_bought_amount === "number" ? row.token_bought_amount : null,
      boughtSymbol: String(row.token_bought_symbol ?? ""),
    })),
  };
}
