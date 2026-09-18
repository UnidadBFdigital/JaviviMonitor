"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { CATEGORICAL, CHART_THEME, TOOLTIP_STYLE } from "@/lib/palette";
import type { NetworkActivityPoint } from "@/lib/sources/coinmetrics";
import { useSource } from "@/lib/useSource";

type Row = { date: string; BTC?: number | null; ETH?: number | null };

const compactNumber = new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 1 });

function pivot(points: NetworkActivityPoint[], metric: "activeAddresses" | "transactions"): Row[] {
  const rows = new Map<string, Row>();
  for (const point of points) {
    const row = rows.get(point.date) ?? { date: point.date };
    row[point.asset] = point[metric];
    rows.set(point.date, row);
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function MetricChart({ rows }: { rows: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={{ stroke: CHART_THEME.grid }}
          minTickGap={42}
          tickFormatter={(date: string) => date.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value: number) => compactNumber.format(value)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, name) => [Number(value).toLocaleString("es-BO"), String(name)]}
          labelFormatter={(date) => String(date)}
        />
        <Line type="monotone" dataKey="BTC" stroke={CATEGORICAL[3]} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="ETH" stroke={CATEGORICAL[0]} strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function NetworkActivityChart() {
  const result = useSource<NetworkActivityPoint[]>(
    "/api/onchain/network-activity",
    "Coin Metrics Community"
  );
  const addressRows = result?.ok ? pivot(result.data, "activeAddresses") : [];
  const transactionRows = result?.ok ? pivot(result.data, "transactions") : [];

  return (
    <section className="rounded-lg border border-line bg-card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Uso observable de red</h3>
          <p className="text-xs text-ink-secondary">
            Direcciones activas y transacciones diarias. Son actividad, no usuarios únicos ni valor transferido.
          </p>
        </div>
        <div className="flex gap-3 text-[10px] text-ink-muted">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: CATEGORICAL[3] }} />BTC</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: CATEGORICAL[0] }} />ETH</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartFrame
          title="Direcciones activas"
          subtitle="30 días"
          loading={result === null}
          error={result?.ok === false ? "no disponible" : null}
          height="h-64"
          exportRows={addressRows}
          exportName="network-active-addresses"
        >
          {result?.ok && <MetricChart rows={addressRows} />}
        </ChartFrame>
        <ChartFrame
          title="Transacciones"
          subtitle="30 días"
          loading={result === null}
          error={result?.ok === false ? "no disponible" : null}
          height="h-64"
          exportRows={transactionRows}
          exportName="network-transactions"
        >
          {result?.ok && <MetricChart rows={transactionRows} />}
        </ChartFrame>
      </div>
      {result?.ok && (
        <p className="mt-3 text-[10px] text-ink-muted">
          Fuente: {result.source} · consultado {new Date(result.fetchedAt).toLocaleString("es-BO")}
          {result.stale && <span className="ml-1 text-warn">(caché)</span>}
        </p>
      )}
    </section>
  );
}
