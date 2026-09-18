"use client";

import { usePayload } from "@/lib/useSource";
import type { RwaSector } from "@/lib/rwaSectors";
import type { ProtocolTvl } from "@/lib/sources/defillama";
import type { RwaMarketToken } from "@/lib/sources/coingecko";
import type { SourceResult } from "@/lib/sources/types";
import type { RwaDashboardMetrics } from "@/lib/sources/defillamaRwa";

export type RwaSourceMeta =
  | { ok: true; source: string; fetchedAt: string; stale?: boolean }
  | { ok: false; source: string; error: string };

export type RwaPayload = {
  source: RwaSourceMeta;
  dashboard: SourceResult<RwaDashboardMetrics>;
  totalUsd: number;
  sectors: RwaSector[];
  protocols: ProtocolTvl[];
  insights: string[];
  marketTokens: SourceResult<RwaMarketToken[]>;
};

// La portada y el hub leen el mismo endpoint; fetchShared comparte la petición.
export function useRwa() {
  return usePayload<RwaPayload>("/api/tokenization/rwa");
}
