"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CATEGORICAL, NEUTRAL, TOOLTIP_STYLE } from "@/lib/palette";

// Orden categórico fijo (nunca ciclado): las series conservan su color
// aunque cambie el filtro. El excedente se agrupa en "Otros".
function sliceColor(index: number, name: string): string {
  return name === "Otros" ? NEUTRAL : CATEGORICAL[index % CATEGORICAL.length];
}

export type DonutItem = { name: string; value: number };

export function DonutChart({
  items,
  formatValue,
  centerLabel,
  maxSlices = 5,
}: {
  items: DonutItem[];
  formatValue: (v: number) => string;
  centerLabel?: string;
  /** cuántas porciones se muestran antes de agrupar el resto en "Otros" */
  maxSlices?: number;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices).reduce((s, i) => s + i.value, 0);
  const data = rest > 0 ? [...top, { name: "Otros", value: rest }] : top;
  const total = data.reduce((s, i) => s + i.value, 0);

  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative h-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="#14171b"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={sliceColor(i, d.name)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatValue(Number(value)), String(name)]}
              contentStyle={TOOLTIP_STYLE}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-ink-secondary">{centerLabel}</span>
          </div>
        )}
      </div>
      <ul className="w-40 space-y-1 text-xs">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: sliceColor(i, d.name) }}
              />
              <span className="truncate text-ink-secondary">{d.name}</span>
            </span>
            <span className="tabular-nums text-ink">
              {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
