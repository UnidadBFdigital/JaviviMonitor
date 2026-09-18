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
  ReferenceLine,
} from "recharts";
import { STATUS, CHART_THEME, TOOLTIP_STYLE, NEUTRAL } from "@/lib/palette";

// Waterfall: contribución de cada componente al cambio total.
// La barra flotante se dibuja con una barra base transparente + la visible.

export type WaterfallItem = { name: string; delta: number };

type Bar = {
  name: string;
  base: number;
  span: number;
  delta: number;
  isTotal: boolean;
};

export function WaterfallChart({
  items,
  totalLabel = "Neto",
  formatValue,
}: {
  items: WaterfallItem[];
  totalLabel?: string;
  formatValue: (v: number) => string;
}) {
  const bars: Bar[] = [];
  let running = 0;
  for (const it of items) {
    const start = running;
    running += it.delta;
    bars.push({
      name: it.name,
      base: Math.min(start, running),
      span: Math.abs(it.delta),
      delta: it.delta,
      isTotal: false,
    });
  }
  bars.push({
    name: totalLabel,
    base: Math.min(0, running),
    span: Math.abs(running),
    delta: running,
    isTotal: true,
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={{ stroke: CHART_THEME.grid }}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => formatValue(v)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(100,116,139,0.10)" }}
          content={({ payload }) => {
            const b = payload?.[0]?.payload as Bar | undefined;
            if (!b) return null;
            return (
              <div className="rounded border border-line bg-card-raised px-2.5 py-1.5 text-[11px] text-ink">
                <span className="font-semibold">{b.name}</span>
                <br />
                <span className={b.delta >= 0 ? "text-up" : "text-down"}>
                  {b.delta >= 0 ? "+" : "−"}
                  {formatValue(Math.abs(b.delta))}
                </span>
              </div>
            );
          }}
        />
        <ReferenceLine y={0} stroke={CHART_THEME.axis} strokeWidth={1} />
        {/* base invisible que levanta la barra visible */}
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="span" stackId="w" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {bars.map((b, i) => (
            <Cell
              key={i}
              fill={b.isTotal ? NEUTRAL : b.delta >= 0 ? STATUS.up : STATUS.down}
              fillOpacity={b.isTotal ? 0.9 : 0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
