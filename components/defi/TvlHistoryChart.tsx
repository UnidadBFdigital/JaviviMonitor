"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { formatUsdCompact } from "@/lib/format";
import { CATEGORICAL, CHART_THEME, TOOLTIP_STYLE } from "@/lib/palette";
import { useSource } from "@/lib/useSource";
import type { TvlPoint } from "@/lib/sources/defillama";

export function TvlHistoryChart() {
  const result = useSource<TvlPoint[]>("/api/defi/tvl-history", "DeFiLlama");

  return (
    <ChartFrame
      title="TVL total en DeFi"
      subtitle="Valor total bloqueado, todas las chains — últimos 12 meses"
      source={result?.ok ? result.source : "DeFiLlama"}
      fetchedAt={result?.ok ? result.fetchedAt : undefined}
      stale={result?.ok ? result.stale : undefined}
      loading={result === null}
      error={result?.ok === false ? "no disponible" : null}
      height="h-64"
      exportRows={result?.ok ? result.data : undefined}
      exportName="tvl-total-defi"
    >
      {result?.ok && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={result.data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="tvlFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CATEGORICAL[0]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CATEGORICAL[0]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: CHART_THEME.axis }}
              tickLine={false}
              axisLine={{ stroke: CHART_THEME.grid }}
              minTickGap={48}
              tickFormatter={(d: string) => d.slice(0, 7)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: CHART_THEME.axis }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => formatUsdCompact(v)}
            />
            <Tooltip
              formatter={(value) => [formatUsdCompact(Number(value)), "TVL"]}
              labelStyle={{ color: CHART_THEME.ink, fontWeight: 600 }}
              contentStyle={TOOLTIP_STYLE}
              cursor={{ stroke: CHART_THEME.axis, strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="tvlUsd"
              stroke={CATEGORICAL[0]}
              strokeWidth={2}
              fill="url(#tvlFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}
