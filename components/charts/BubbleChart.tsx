"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CATEGORICAL, NEUTRAL, SCATTER_SLOTS, CHART_THEME } from "@/lib/palette";

export type BubblePoint = {
  name: string;
  x: number;
  y: number;
  z: number; // tamaño de la burbuja
  group?: string; // categoría — define el color
};

export function BubbleChart({
  points,
  xLabel,
  yLabel,
  zLabel,
  formatX,
  formatY,
  formatZ,
  logarithmic = true,
}: {
  points: BubblePoint[];
  xLabel: string;
  yLabel: string;
  zLabel: string;
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  formatZ: (v: number) => string;
  logarithmic?: boolean;
}) {
  // En scatter cualquier par de marcas puede quedar contiguo: rige el
  // chequeo all-pairs y solo los 3 primeros slots lo aprueban. Las
  // categorías más frecuentes se quedan con color; el resto va a "Otros".
  const counts = new Map<string, number>();
  for (const p of points) {
    const g = p.group ?? "Otros";
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  const named = ranked.filter((g) => g !== "Otros").slice(0, SCATTER_SLOTS);
  const colorOf = (group: string | undefined) => {
    const idx = named.indexOf(group ?? "Otros");
    return idx >= 0 ? CATEGORICAL[idx] : NEUTRAL;
  };

  const series = [
    ...named.map((g) => ({ group: g, data: points.filter((p) => (p.group ?? "Otros") === g) })),
    { group: "Otros", data: points.filter((p) => !named.includes(p.group ?? "Otros")) },
  ].filter((s) => s.data.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHART_THEME.grid} />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              tick={{ fontSize: 10, fill: CHART_THEME.axis }}
              tickLine={false}
              axisLine={{ stroke: CHART_THEME.grid }}
              tickFormatter={formatX}
              scale={logarithmic ? "log" : "auto"}
              domain={logarithmic ? ["auto", "auto"] : [0, 10]}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              tick={{ fontSize: 10, fill: CHART_THEME.axis }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={formatY}
              scale={logarithmic ? "log" : "auto"}
              domain={logarithmic ? ["auto", "auto"] : [0, 10]}
            />
            <ZAxis type="number" dataKey="z" range={[80, 900]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: CHART_THEME.axis }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as BubblePoint | undefined;
                if (!p) return null;
                return (
                  <div className="rounded border border-line bg-card-raised px-2.5 py-1.5 text-[11px] leading-relaxed text-ink">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ background: colorOf(p.group) }}
                      />
                      {p.name}
                    </span>
                    {p.group && <div className="text-ink-secondary">{p.group}</div>}
                    {xLabel}: {formatX(p.x)}
                    <br />
                    {yLabel}: {formatY(p.y)}
                    <br />
                    {zLabel}: {formatZ(p.z)}
                  </div>
                );
              }}
            />
            {series.map((s) => (
              <Scatter
                key={s.group}
                name={s.group}
                data={s.data}
                fill={colorOf(s.group)}
                fillOpacity={0.6}
                stroke={colorOf(s.group)}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {series.map((s) => (
          <li key={s.group} className="flex items-center gap-1.5 text-ink-secondary">
            <span className="h-2 w-2 rounded-sm" style={{ background: colorOf(s.group) }} />
            {s.group} ({s.data.length})
          </li>
        ))}
      </ul>
    </div>
  );
}
