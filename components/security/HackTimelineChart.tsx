"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORICAL, CHART_THEME, TOOLTIP_STYLE } from "@/lib/palette";
import { formatUsdCompact } from "@/lib/format";
import type { TimelinePoint } from "@/lib/hackStats";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-03" → "mar 26"; los años se dejan tal cual. */
function axisLabel(label: string): string {
  if (label.length === 4) return label;
  const [year, month] = label.split("-");
  return `${MONTHS[Number(month) - 1]} ${year.slice(2)}`;
}

const AMOUNT = CATEGORICAL[1]; // naranja
const COUNT = CATEGORICAL[0]; // azul

export function HackTimelineChart({ points }: { points: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={{ stroke: CHART_THEME.grid }}
          minTickGap={28}
          tickFormatter={axisLabel}
        />
        <YAxis
          yAxisId="amount"
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => formatUsdCompact(v)}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={false}
          width={30}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(232,237,242,0.05)" }}
          labelFormatter={(label) => axisLabel(String(label))}
          formatter={(value, name) => [
            name === "Robado"
              ? formatUsdCompact(Number(value))
              : `${Number(value).toLocaleString("es-BO")} incidentes`,
            String(name),
          ]}
        />
        <Bar
          yAxisId="amount"
          dataKey="amountUsd"
          name="Robado"
          fill={AMOUNT}
          fillOpacity={0.8}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          yAxisId="count"
          type="monotone"
          dataKey="count"
          name="Incidentes"
          stroke={COUNT}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
