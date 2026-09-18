import type { AssetFilter, OperationSummary, YieldMix, YieldPool, YieldPulse, YieldQuery } from "./yields";

export type { YieldReference, YieldPulse } from "./yields";

// Respuestas de /api/yields y /api/yields/report. Viven aparte para que los
// componentes de cliente importen los tipos sin arrastrar el adaptador de red.

export type YieldUniverseInfo = {
  pools: number;
  tvlUsd: number;
  withoutYield: number;
  published: number;
  borrowRates: boolean;
};

export type YieldsPayload =
  | {
      ok: true;
      query: YieldQuery;
      rows: YieldPool[];
      total: number;
      page: number;
      pages: number;
      /** mejores opciones con señales bajas, una por protocolo */
      featured: YieldPool[];
      /** rango de APY por operación con los filtros de activo, riesgo, red y búsqueda */
      operations: OperationSummary[];
      chains: { name: string; count: number }[];
      /** referencias del mercado, independientes de los filtros */
      pulse: YieldPulse;
      universe: YieldUniverseInfo;
      source: string;
      sourceUrl: string;
      fetchedAt: string;
      stale: boolean;
    }
  | { ok: false; source: string; error: string };

/** Insumo del capítulo de rendimientos del informe descargable, en una sola llamada. */
export type YieldsReportPayload =
  | {
      ok: true;
      pulse: YieldPulse;
      /** rangos por operación con el perfil equilibrado */
      operations: OperationSummary[];
      featured: YieldPool[];
      /** mejores opciones con perfil conservador, por activo */
      byAsset: { asset: AssetFilter; label: string; pools: YieldPool[] }[];
      /** riesgo sobre todo el universo; plazos sobre el perfil equilibrado */
      mix: YieldMix;
      universe: YieldUniverseInfo;
      source: string;
      sourceUrl: string;
      fetchedAt: string;
      stale: boolean;
    }
  | { ok: false; source: string; error: string };
