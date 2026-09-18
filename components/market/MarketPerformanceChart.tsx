"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { formatPct } from "@/lib/format";
import { CATEGORICAL, CHART_THEME, TOOLTIP_STYLE } from "@/lib/palette";
import { useSource } from "@/lib/useSource";
import type { MarketPerformance } from "@/lib/sources/coingecko";

export function MarketPerformanceChart() {
  const result = useSource<MarketPerformance>("/api/market/performance?days=90", "CoinGecko");
  const assets = result?.ok ? result.data.assets : [];
  const symbolById = new Map(assets.map((asset) => [asset.id, asset.symbol]));

  return (
    <ChartFrame
      title="Rendimiento relativo · principales activos"
      subtitle="Precio normalizado a 100 al inicio · retorno, drawdown y volatilidad de 90 días"
      source={result?.ok ? result.source : "CoinGecko"}
      fetchedAt={result?.ok ? result.fetchedAt : undefined}
      stale={result?.ok ? result.stale : undefined}
      loading={result === null}
      error={result?.ok === false || assets.length < 2 ? "no disponible" : null}
      height="h-96"
      exportRows={result?.ok ? result.data.points : undefined}
      exportName="rendimiento-relativo-cripto-90d"
    >
      {result?.ok && assets.length >= 2 && (
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.data.points} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: CHART_THEME.axis }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_THEME.grid }}
                  minTickGap={44}
                  tickFormatter={(date: string) => date.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: CHART_THEME.axis }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickFormatter={(value: number) => value.toFixed(0)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(date) => String(date)}
                  formatter={(value, name) => [
                    `${Number(value).toFixed(1)} (${Number(value) >= 100 ? "+" : ""}${(
                      Number(value) - 100
                    ).toFixed(1)}%)`,
                    symbolById.get(String(name)) ?? String(name),
                  ]}
                />
                {assets.map((asset, index) => (
                  <Line
                    key={asset.id}
                    type="monotone"
                    dataKey={asset.id}
                    name={asset.id}
                    stroke={CATEGORICAL[index]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line/60 pt-3 lg:grid-cols-4">
            {assets.map((asset, index) => (
              <div key={asset.id} className="rounded border border-line/60 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CATEGORICAL[index] }}
                    />
                    {asset.symbol}
                  </span>
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      asset.returnPct >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {formatPct(asset.returnPct)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] tabular-nums text-ink-muted">
                  DD máx. {formatPct(asset.maxDrawdownPct)} · Vol. anual. {formatPct(asset.volatilityAnnPct)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartFrame>
  );
}
