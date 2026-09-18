"use client";

import { ChartFrame } from "@/components/charts/ChartFrame";
import { usePayload } from "@/lib/useSource";
import { TreemapChart } from "@/components/charts/TreemapChart";
import { formatUsdCompact } from "@/lib/format";
import type { ProtocolTvl } from "@/lib/sources/defillama";
import type { SourceResult } from "@/lib/sources/types";

type Analytics = { protocols: SourceResult<ProtocolTvl[]> };

// Heatmap de mercado (treemap): tamaño = TVL, color = variación 7d.
export function DefiTreemapCard() {
  const { data, error } = usePayload<Analytics>("/api/defi/analytics");

  const p = data?.protocols;
  return (
    <ChartFrame
      title="Market Heatmap — DeFi"
      subtitle="Tamaño = TVL · color = variación 7d (verde sube, rojo baja)"
      source={p?.ok ? p.source : "DeFiLlama"}
      fetchedAt={p?.ok ? p.fetchedAt : undefined}
      stale={p?.ok ? p.stale : undefined}
      loading={!data && !error}
      error={error || p?.ok === false ? "no disponible" : null}
      height="h-[420px]"
      exportRows={p?.ok ? p.data.map((x) => ({ ...x })) : undefined}
      exportName="defi-heatmap"
    >
      {p?.ok && (
        <TreemapChart
          items={p.data.slice(0, 20).map((x) => ({
            name: x.name,
            value: x.tvlUsd,
            changePct: x.change7dPct,
          }))}
          formatValue={formatUsdCompact}
        />
      )}
    </ChartFrame>
  );
}
