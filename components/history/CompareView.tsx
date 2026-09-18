"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { exportCsv } from "@/lib/chartExport";
import { CATEGORICAL, CHART_THEME } from "@/lib/palette";
import { rebaseTogether, sliceDays, type RebasedRow } from "@/lib/historySeries";
import type { HistoryMetric } from "@/lib/historyTypes";
import { formatDate, formatFullDate, signedPct } from "./historyFormat";

// TVL y precio del token en un mismo eje, sin doble escala: las dos series
// valen 100 el primer día que comparten dentro del rango. La pendiente de cada
// línea es crecimiento relativo; la brecha dice si el TVL se movió más o menos
// que el token.

const SURFACE = CHART_THEME.surface;
const LEFT = CATEGORICAL[0];
const RIGHT = CATEGORICAL[1];

function pointsLabel(value: number): string {
  return value.toFixed(0);
}

function CompareTooltip({
  active,
  payload,
  label,
  names,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; dataKey?: unknown }>;
  label?: unknown;
  names: Record<"left" | "right", { label: string; color: string }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-line bg-card-raised px-2.5 py-2 text-[11px] shadow-lg">
      <p className="mb-1 text-ink-muted">{formatFullDate(String(label))}</p>
      {payload.map((row) => {
        const key = row.dataKey === "right" ? "right" : "left";
        const value = Number(row.value);
        return (
          <p key={key} className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: names[key].color }} aria-hidden />
            <span className="font-semibold text-ink">{pointsLabel(value)}</span>
            <span className="text-ink-muted">({signedPct(value - 100)})</span>
            <span className="text-ink-secondary">{names[key].label}</span>
          </p>
        );
      })}
    </div>
  );
}

export function CompareView({
  left,
  right,
  days,
  long,
  view,
  exportName,
}: {
  left: HistoryMetric;
  right: HistoryMetric;
  days: number | null;
  long: boolean;
  view: "chart" | "table";
  exportName: string;
}) {
  const rows: RebasedRow[] = useMemo(
    () => rebaseTogether(sliceDays(left.points, days), sliceDays(right.points, days)),
    [left, right, days]
  );

  if (rows.length < 2) {
    return (
      <div className="rounded border border-line bg-card-raised p-4 text-[12px] text-ink-secondary">
        Las dos series no comparten fechas suficientes en este rango. Probá un rango más largo.
      </div>
    );
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const leftChange = last.left - 100;
  const rightChange = last.right - 100;
  const gap = leftChange - rightChange;
  const names = {
    left: { label: left.label, color: LEFT },
    right: { label: right.label, color: RIGHT },
  };

  function download() {
    exportCsv(
      rows.map((row) => ({
        fecha: row.date,
        [`${left.label} (base 100)`]: Number(row.left.toFixed(2)),
        [`${right.label} (base 100)`]: Number(row.right.toFixed(2)),
      })),
      exportName
    );
  }

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            [left, leftChange, LEFT],
            [right, rightChange, RIGHT],
          ] as const
        ).map(([metric, change, color]) => (
          <div key={metric.key} className="border border-line bg-card-raised p-2">
            <p className="flex items-center gap-1.5 text-[10px] text-ink-muted">
              <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} aria-hidden />
              {metric.label} desde {formatFullDate(first.date)}
            </p>
            <p className={`mt-0.5 text-base font-semibold ${change >= 0 ? "text-up" : "text-down"}`}>
              {change >= 0 ? "▲" : "▼"} {signedPct(change)}
            </p>
          </div>
        ))}
        <div className="border border-line bg-card-raised p-2">
          <p
            className="text-[10px] text-ink-muted"
            title="Diferencia entre las dos variaciones, en puntos porcentuales. Positiva: el TVL creció más (o cayó menos) que el precio del token en el rango. Negativa: lo contrario."
          >
            Brecha TVL − precio
          </p>
          <p className="mt-0.5 text-base font-semibold">
            {gap >= 0 ? "+" : "−"}
            {Math.abs(gap).toFixed(1)} pp
          </p>
        </div>
        <div className="border border-line bg-card-raised p-2">
          <p className="text-[10px] text-ink-muted">Días comparados</p>
          <p className="mt-0.5 text-base font-semibold">{rows.length}</p>
        </div>
      </div>

      {view === "chart" ? (
        <>
          <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1" aria-label="Leyenda">
            {(["left", "right"] as const).map((key) => (
              <li key={key} className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: names[key].color }} aria-hidden />
                {names[key].label}
                <span className="tabular-nums text-ink">{pointsLabel(key === "left" ? last.left : last.right)}</span>
              </li>
            ))}
          </ul>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: CHART_THEME.axis }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_THEME.grid }}
                  minTickGap={48}
                  tickFormatter={(d: string) => formatDate(d, long)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: CHART_THEME.axis }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={["auto", "auto"]}
                  tickFormatter={pointsLabel}
                />
                <ReferenceLine y={100} stroke={CHART_THEME.axis} strokeDasharray="3 3" />
                <Tooltip
                  cursor={{ stroke: CHART_THEME.axis, strokeWidth: 1 }}
                  content={(props) => (
                    <CompareTooltip active={props.active} payload={props.payload} label={props.label} names={names} />
                  )}
                />
                {(["left", "right"] as const).map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={names[key].color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 4, fill: names[key].color, stroke: SURFACE, strokeWidth: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="max-h-72 overflow-auto border border-line">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-[10px] uppercase tracking-wide text-ink-muted">
                <th className="border-b border-line px-2 py-1.5 font-medium">Fecha</th>
                <th className="border-b border-line px-2 py-1.5 text-right font-medium">{left.label} · base 100</th>
                <th className="border-b border-line px-2 py-1.5 text-right font-medium">{right.label} · base 100</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((row) => (
                <tr key={row.date} className="border-b border-line/40 last:border-0">
                  <td className="px-2 py-1 text-ink-secondary">{formatFullDate(row.date)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{row.left.toFixed(1)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{row.right.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-muted">
        <span>
          Ambas valen 100 el {formatFullDate(first.date)}, primer día con dato de las dos. El precio llega hasta 365 días
          atrás: la comparación no va más lejos.
        </span>
        <button type="button" onClick={download} className="ml-auto text-core transition-colors hover:text-electric">
          Exportar CSV
        </button>
      </div>
    </>
  );
}
