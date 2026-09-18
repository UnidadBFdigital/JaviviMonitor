"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { usePayload } from "@/lib/useSource";
import { BubbleChart } from "@/components/charts/BubbleChart";
import { TreemapChart } from "@/components/charts/TreemapChart";
import { formatUsdCompact } from "@/lib/format";
import { colorAt, CHART_THEME, TOOLTIP_STYLE } from "@/lib/palette";
import type {
  ProtocolTvl,
  ProtocolRevenue,
  ChainTvl,
  DexOverview,
} from "@/lib/sources/defillama";
import type { SourceResult } from "@/lib/sources/types";

type Analytics = {
  protocols: SourceResult<ProtocolTvl[]>;
  revenue: SourceResult<ProtocolRevenue[]>;
  chains: SourceResult<ChainTvl[]>;
  dex: SourceResult<DexOverview>;
};

function useAnalytics() {
  // petición compartida entre las tres cards de esta vista
  return usePayload<Analytics>("/api/defi/analytics");
}

// Revenue vs TVL: cruza los dos rankings de DeFiLlama por nombre.
// El color codifica la categoría del protocolo (Lending, Dexs, …).
export function RevenueVsTvlBubble() {
  const { data, error } = useAnalytics();

  let points: { name: string; x: number; y: number; z: number; group: string }[] = [];
  if (data?.protocols.ok && data.revenue.ok) {
    const revByName = new Map(data.revenue.data.map((r) => [r.name.toLowerCase().trim(), r]));
    points = data.protocols.data
      .flatMap((p) => {
        const rev = revByName.get(p.name.toLowerCase().trim());
        if (!rev || rev.revenue24hUsd <= 0) return [];
        return [
          {
            name: p.name,
            x: p.tvlUsd,
            y: rev.revenue24hUsd,
            z: rev.revenue30dUsd ?? rev.revenue24hUsd,
            group: p.category || "Otros",
          },
        ];
      })
      .sort((a, b) => b.y - a.y)
      .slice(0, 25);
  }

  return (
    <ChartFrame
      title="Revenue vs TVL"
      subtitle="Color = categoría · escala log · tamaño = revenue 30d"
      source="DeFiLlama"
      fetchedAt={data?.protocols.ok ? data.protocols.fetchedAt : undefined}
      loading={!data && !error}
      error={error || points.length === 0 ? "no disponible" : null}
      height="h-80"
      exportRows={points.map((p) => ({
        protocolo: p.name,
        categoria: p.group,
        tvlUsd: p.x,
        revenue24hUsd: p.y,
      }))}
      exportName="revenue-vs-tvl"
    >
      <BubbleChart
        points={points}
        xLabel="TVL"
        yLabel="Revenue 24h"
        zLabel="Revenue 30d"
        formatX={formatUsdCompact}
        formatY={formatUsdCompact}
        formatZ={formatUsdCompact}
      />
    </ChartFrame>
  );
}

export function ChainTreemapCard() {
  const { data, error } = useAnalytics();
  const chains = data?.chains;

  return (
    <ChartFrame
      title="TVL por blockchain"
      subtitle="Distribución del valor bloqueado entre chains"
      source={chains?.ok ? chains.source : "DeFiLlama"}
      fetchedAt={chains?.ok ? chains.fetchedAt : undefined}
      loading={!data && !error}
      error={error || chains?.ok === false ? "no disponible" : null}
      height="h-80"
      exportRows={chains?.ok ? chains.data : undefined}
      exportName="tvl-por-chain"
    >
      {chains?.ok && (
        <TreemapChart
          mode="categorical"
          items={chains.data.map((c) => ({ name: c.name, value: c.tvlUsd }))}
          formatValue={formatUsdCompact}
        />
      )}
    </ChartFrame>
  );
}

export function DexRankingCard() {
  const { data, error } = useAnalytics();
  const dex = data?.dex;
  const rows = dex?.ok ? dex.data.topDexs : [];

  return (
    <ChartFrame
      title="Ranking de DEXs por volumen 24h"
      subtitle={
        dex?.ok
          ? `Volumen agregado del sector: ${formatUsdCompact(dex.data.total24hUsd)}`
          : "Volumen agregado del sector"
      }
      source={dex?.ok ? dex.source : "DeFiLlama"}
      fetchedAt={dex?.ok ? dex.fetchedAt : undefined}
      loading={!data && !error}
      error={error || rows.length === 0 ? "no disponible" : null}
      height="h-72"
      exportRows={rows}
      exportName="ranking-dex"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_THEME.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: CHART_THEME.axis }}
            tickLine={false}
            axisLine={{ stroke: CHART_THEME.grid }}
            tickFormatter={(v: number) => formatUsdCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: CHART_THEME.axis }}
            tickLine={false}
            axisLine={false}
            width={116}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "rgba(100,116,139,0.10)" }}
            formatter={(value) => [formatUsdCompact(Number(value)), "Volumen 24h"]}
          />
          <Bar dataKey="volume24hUsd" radius={[0, 3, 3, 0]} barSize={16}>
            {rows.map((_, i) => (
              <Cell key={i} fill={colorAt(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
