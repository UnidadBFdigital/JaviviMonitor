"use client";

import { useState } from "react";
import { CHART_THEME } from "@/lib/palette";
import type { SeriesPoint } from "@/lib/networks/types";

// Gráfico de líneas comparado, con leyenda que enciende y apaga redes y una
// guía vertical que lee todas las series a la vez. Es el caballo de batalla
// visual del módulo: costo, direcciones, TVL y commits usan este mismo
// componente en vez de repetir tres veces el mismo SVG.

export type TrendSeries = {
  id: string;
  name: string;
  color: string;
  points: SeriesPoint[];
};

const W = 900;
const PAD = { top: 12, right: 14, bottom: 24, left: 62 };

export function TrendLines({
  series,
  log = false,
  formatValue,
  height = 260,
  emptyLabel = "Sin series para graficar con los filtros actuales.",
}: {
  series: TrendSeries[];
  log?: boolean;
  formatValue: (value: number) => string;
  height?: number;
  emptyLabel?: string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<number | null>(null);

  const visible = series.filter((s) => !hidden.has(s.id) && s.points.length > 1);

  // eje x común: unión de fechas de todas las series, no la primera que llegue
  const dates = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.date)))).sort();

  if (series.length === 0 || dates.length < 2) {
    return <p className="flex h-40 items-center justify-center text-xs text-ink-muted">{emptyLabel}</p>;
  }

  const values = visible.flatMap((s) => s.points.map((p) => p.value)).filter((v) => (log ? v > 0 : Number.isFinite(v)));
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;

  const t = (v: number) => (log ? Math.log10(Math.max(v, min > 0 ? min : 1e-9)) : v);
  const lo = t(min);
  const hi = t(max);
  const span = hi - lo || 1;
  const plotH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + (1 - (t(v) - lo) / span) * plotH;
  const stepX = (W - PAD.left - PAD.right) / Math.max(1, dates.length - 1);
  const x = (index: number) => PAD.left + index * stepX;

  const gridValues = log
    ? [min, 10 ** ((lo + hi) / 2), max]
    : [min, (min + max) / 2, max];

  const indexByDate = new Map(dates.map((date, i) => [date, i]));

  function onMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round((ratio * W - PAD.left) / stepX);
    setCursor(index >= 0 && index < dates.length ? index : null);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
        {series.map((line) => {
          const on = !hidden.has(line.id);
          return (
            <button
              key={line.id}
              type="button"
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(line.id)) next.delete(line.id);
                  else next.add(line.id);
                  return next;
                })
              }
              className={`flex items-center gap-1.5 text-[10px] transition-opacity ${
                on ? "text-ink-secondary" : "text-ink-muted opacity-50"
              }`}
              aria-pressed={on}
            >
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: on ? line.color : "transparent", border: `1px solid ${line.color}` }}
                aria-hidden
              />
              {line.name}
            </button>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setCursor(null)}
        role="img"
      >
        {gridValues.map((value, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={y(value)} x2={W - PAD.right} y2={y(value)} stroke={CHART_THEME.grid} strokeWidth={1} />
            <text x={PAD.left - 6} y={y(value) + 3} textAnchor="end" fontSize={9} fill={CHART_THEME.axis}>
              {formatValue(value)}
            </text>
          </g>
        ))}

        {visible.map((line) => {
          const path = line.points
            .filter((p) => (log ? p.value > 0 : Number.isFinite(p.value)))
            .map((p) => {
              const index = indexByDate.get(p.date);
              return index === undefined ? null : `${x(index).toFixed(1)},${y(p.value).toFixed(1)}`;
            })
            .filter((p): p is string => p !== null)
            .join(" ");
          return (
            <polyline
              key={line.id}
              points={path}
              fill="none"
              stroke={line.color}
              strokeWidth={1.7}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.92}
            />
          );
        })}

        {cursor !== null && (
          <line
            x1={x(cursor)}
            y1={PAD.top}
            x2={x(cursor)}
            y2={height - PAD.bottom}
            stroke={CHART_THEME.axis}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {cursor !== null &&
          visible.map((line) => {
            const point = line.points.find((p) => p.date === dates[cursor]);
            if (!point || (log && point.value <= 0)) return null;
            return (
              <circle key={line.id} cx={x(cursor)} cy={y(point.value)} r={3} fill={line.color} stroke="#14171b" strokeWidth={1} />
            );
          })}

        {[0, Math.floor(dates.length / 2), dates.length - 1].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 7}
            textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"}
            fontSize={9}
            fill={CHART_THEME.axis}
          >
            {dates[i]?.slice(5)}
          </text>
        ))}
      </svg>

      {cursor !== null && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-line pt-1.5 text-[10px]">
          <span className="text-ink-muted">{dates[cursor]}</span>
          {visible
            .map((line) => ({ line, point: line.points.find((p) => p.date === dates[cursor]) }))
            .filter((entry) => entry.point !== undefined)
            .sort((a, b) => (b.point!.value ?? 0) - (a.point!.value ?? 0))
            .map(({ line, point }) => (
              <span key={line.id} className="flex items-center gap-1 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-sm" style={{ background: line.color }} aria-hidden />
                <span className="text-ink-secondary">{line.name}</span>
                <span className="text-ink">{formatValue(point!.value)}</span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
