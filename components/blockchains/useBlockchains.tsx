"use client";

import { usePayload } from "@/lib/useSource";
import type { ScoredNetwork, UseCaseRecommendation, Weights } from "@/lib/bbi";
import type { ChainActivityMetric } from "@/lib/sources/defillamaDashboard";
import type { SourceResult } from "@/lib/sources/types";
import type { ACTIVITY_METRICS } from "@/lib/bbiMethodology";

export type BbimPayload = {
  source: { ok: true; source: string; fetchedAt: string; stale?: boolean } | { ok: false; source: string };
  asOf: string;
  weights: Weights;
  networks: ScoredNetwork[];
  insights: string[];
  recommendations: UseCaseRecommendation[];
  methodology: { version: string; metrics: typeof ACTIVITY_METRICS; activity: string; editorial: string };
  stablecoinSource: { ok: true; source: string; fetchedAt: string; stale?: boolean } | { ok: false; source: string };
  activity: SourceResult<ChainActivityMetric[]>;
};

// Las tres vistas del BBIM leen el mismo endpoint; fetchShared lo comparte.
export function useBlockchains() {
  return usePayload<BbimPayload>("/api/blockchains");
}

export const GROUP_STYLE: Record<string, string> = {
  "Infraestructura general": "bg-electric/15 text-electric",
  "Infraestructura institucional / RWA": "bg-up/15 text-up",
  "Infraestructura de pagos": "bg-warn/15 text-warn",
  "Ecosistemas emergentes": "bg-ice text-ink-secondary",
};

export function GroupChip({ group }: { group: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] ${
        GROUP_STYLE[group] ?? "bg-ice text-ink-secondary"
      }`}
    >
      {group}
    </span>
  );
}
