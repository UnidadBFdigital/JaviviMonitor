"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchShared } from "@/lib/fetchShared";
import { exportCsv } from "@/lib/chartExport";
import { formatUsdCompact } from "@/lib/format";
import { CATEGORICAL, CHART_THEME, NEUTRAL } from "@/lib/palette";
import { seriesStats, sliceDays } from "@/lib/historySeries";
import type { HistoryPayload, HistoryPoint, HistoryTarget, HistoryUnit } from "@/lib/historyTypes";
import { CompareView } from "./CompareView";
import { formatDate, formatFullDate, formatValue, signedPct, signedPp } from "./historyFormat";

// Ficha lateral con el histórico de una entidad. Especificación de marca de
// la guía de visualización: línea de 2px, relleno como lavado al 10%, grilla
// en hairline sólida, crosshair que lee todas las series, un solo eje, leyenda
// solo cuando hay dos series o más, y siempre una tabla gemela del gráfico.

const SURFACE = CHART_THEME.surface;
const SERIES = CATEGORICAL[0];

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "30", label: "30D", days: 30 },
  { key: "90", label: "90D", days: 90 },
  { key: "365", label: "1A", days: 365 },
  { key: "all", label: "Todo", days: null },
];

/** Pestaña de la comparación TVL vs precio: no es una métrica de la fuente. */
const COMPARE_KEY = "__compare";

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `hace ${hours} h` : `hace ${Math.round(hours / 24)} d`;
}

/* ---------- tooltip: el valor manda, la serie acompaña ---------- */

type TooltipRow = { value?: unknown; name?: unknown; color?: string; dataKey?: unknown };

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  names,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipRow>;
  label?: unknown;
  unit: HistoryUnit;
  names?: Map<string, { label: string; color: string }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = [...payload].reverse();
  return (
    <div className="rounded border border-line bg-card-raised px-2.5 py-2 text-[11px] shadow-lg">
      <p className="mb-1 text-ink-muted">{formatFullDate(String(label))}</p>
      {rows.map((row) => {
        const key = String(row.dataKey ?? "");
        const meta = names?.get(key);
        return (
          <p key={key} className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: meta?.color ?? row.color }} aria-hidden />
            <span className="font-semibold text-ink">{formatValue(Number(row.value), unit)}</span>
            {meta && <span className="text-ink-secondary">{meta.label}</span>}
          </p>
        );
      })}
    </div>
  );
}

/* ---------- ficha ---------- */

type Loaded = { key: string; payload: HistoryPayload | null; error: boolean };

export function HistoryDrawer({
  target,
  parent,
  onBack,
  onClose,
  onDrill,
}: {
  target: HistoryTarget;
  parent: HistoryTarget | null;
  onBack: () => void;
  onClose: () => void;
  onDrill: (target: HistoryTarget) => void;
}) {
  const url = `/api/history?kind=${encodeURIComponent(target.kind)}&id=${encodeURIComponent(target.id)}&label=${encodeURIComponent(target.label)}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", payload: null, error: false });
  const [range, setRange] = useState("365");
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    fetchShared<HistoryPayload>(url)
      .then((payload) => alive && setLoaded({ key: url, payload, error: false }))
      .catch(() => alive && setLoaded({ key: url, payload: null, error: true }));
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    closeButton.current?.focus();
  }, [url]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // mientras llega la nueva serie se conserva la anterior atenuada: sin
  // parpadeo de esqueleto ni salto de layout al navegar entre entidades
  const loading = loaded.key !== url;
  const payload = loaded.payload;
  const ready = payload?.ok ? payload : null;

  const metric = ready ? (ready.metrics.find((m) => m.key === metricKey) ?? ready.metrics[0]) : null;
  // la comparación es una pestaña más; si falta alguna de sus dos series, no se ofrece
  const compare = ready?.compare ?? null;
  const compareLeft = compare ? ready?.metrics.find((m) => m.key === compare.left) : undefined;
  const compareRight = compare ? ready?.metrics.find((m) => m.key === compare.right) : undefined;
  const comparing = metricKey === COMPARE_KEY && compareLeft !== undefined && compareRight !== undefined;
  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  const points = useMemo(() => (metric ? sliceDays(metric.points, days) : []), [metric, days]);
  const stats = useMemo(() => seriesStats(points), [points]);
  const long = days === null || days > 120;

  const composition = useMemo(() => {
    if (!ready?.composition) return null;
    const series = ready.composition.map((c, i) => ({
      ...c,
      color: c.key === "resto" ? NEUTRAL : CATEGORICAL[i % CATEGORICAL.length],
      points: sliceDays(c.points, days),
    }));
    const rows = (series[0]?.points ?? []).map((point, index) => {
      const row: Record<string, string | number> = { date: point.date };
      for (const s of series) row[s.key] = s.points[index]?.value ?? 0;
      return row;
    });
    return { series, rows };
  }, [ready, days]);

  const shortRange = metric ? metric.points.length > 0 && Date.parse(metric.points.at(-1)!.date) - Date.parse(metric.points[0].date) < 364 * 86_400_000 : false;

  function download() {
    if (!metric || !ready) return;
    exportCsv(
      points.map((p: HistoryPoint) => ({ fecha: p.date, [metric.label]: p.value })),
      `historico-${ready.target.kind}-${ready.target.id}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-")
    );
  }

  const titleId = `history-title-${target.kind}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Cerrar ficha"
        tabIndex={-1}
        onClick={onClose}
        className="bf-fade-in absolute inset-0 cursor-default bg-surface/60"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bf-drawer-in relative flex h-full w-full max-w-2xl flex-col border-l border-line bg-card shadow-2xl"
      >
        {/* cabecera */}
        <div className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            {parent && (
              <button
                type="button"
                onClick={onBack}
                className="mb-1 text-[11px] text-core transition-colors hover:text-electric"
              >
                ← Volver a {parent.label}
              </button>
            )}
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-electric">
              Histórico
            </p>
            <h2 id={titleId} className="truncate text-lg font-semibold tracking-tight">
              {ready?.title ?? target.label}
            </h2>
            <p className="text-[12px] text-ink-secondary">
              {ready?.subtitle ?? (loading ? "Consultando la fuente…" : "")}
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-line px-2 py-1 text-[11px] text-ink-secondary transition-colors hover:bg-ice/50 hover:text-ink"
          >
            Cerrar ✕
          </button>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-3 transition-opacity ${loading && payload ? "opacity-50" : ""}`}>
          {!payload && loading && (
            <div className="space-y-3">
              <div className="bf-shimmer h-16 rounded" />
              <div className="bf-shimmer h-64 rounded" />
            </div>
          )}

          {!loading && (loaded.error || (payload && !payload.ok)) && (
            <div className="rounded border border-line bg-card-raised p-4 text-sm">
              <p className="text-ink">No hay histórico disponible.</p>
              <p className="mt-1 text-[12px] text-ink-secondary">
                {payload && !payload.ok ? `${payload.error} (${payload.source}).` : "La consulta falló."} El terminal no
                reconstruye series que la fuente no publica.
              </p>
            </div>
          )}

          {ready && metric && stats && (
            <>
              {/* filtros: rango primero, métrica después */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex" role="group" aria-label="Rango de fechas">
                  {RANGES.map((r, i) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRange(r.key)}
                      aria-pressed={range === r.key}
                      className={`border px-2.5 py-1 text-[11px] transition-colors ${i > 0 ? "-ml-px" : ""} ${
                        range === r.key
                          ? "border-electric bg-electric/10 text-ink"
                          : "border-line text-ink-secondary hover:text-ink"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {ready.metrics.length > 1 && (
                  <div className="flex" role="group" aria-label="Métrica">
                    {ready.metrics.map((m, i) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setMetricKey(m.key)}
                        aria-pressed={!comparing && metric.key === m.key}
                        className={`border px-2.5 py-1 text-[11px] transition-colors ${i > 0 ? "-ml-px" : ""} ${
                          !comparing && metric.key === m.key
                            ? "border-electric bg-electric/10 text-ink"
                            : "border-line text-ink-secondary hover:text-ink"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                    {compare && compareLeft && compareRight && (
                      <button
                        type="button"
                        onClick={() => setMetricKey(COMPARE_KEY)}
                        aria-pressed={comparing}
                        title="TVL y precio del token indexados a 100 en un mismo eje"
                        className={`-ml-px border px-2.5 py-1 text-[11px] transition-colors ${
                          comparing
                            ? "border-electric bg-electric/10 text-ink"
                            : "border-line text-ink-secondary hover:text-ink"
                        }`}
                      >
                        {compare.label}
                      </button>
                    )}
                  </div>
                )}
                <div className="ml-auto flex" role="group" aria-label="Vista">
                  {(["chart", "table"] as const).map((v, i) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-pressed={view === v}
                      className={`border px-2.5 py-1 text-[11px] transition-colors ${i > 0 ? "-ml-px" : ""} ${
                        view === v
                          ? "border-electric bg-electric/10 text-ink"
                          : "border-line text-ink-secondary hover:text-ink"
                      }`}
                    >
                      {v === "chart" ? "Gráfico" : "Tabla"}
                    </button>
                  ))}
                </div>
              </div>

              {comparing && compareLeft && compareRight ? (
                <CompareView
                  left={compareLeft}
                  right={compareRight}
                  days={days}
                  long={long}
                  view={view}
                  exportName={`historico-${ready.target.kind}-${ready.target.id}-tvl-vs-precio`
                    .toLowerCase()
                    .replace(/[^a-z0-9-]+/g, "-")}
                />
              ) : (
                <>
                {/* cifras del rango */}
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="border border-line bg-card-raised p-2">
                    <p className="text-[10px] text-ink-muted">Último · {formatFullDate(stats.last.date)}</p>
                    <p className="mt-0.5 text-base font-semibold">{formatValue(stats.last.value, metric.unit)}</p>
                  </div>
                  {metric.unit === "pct" ? (
                    // una tasa cambia en puntos porcentuales: de 4% a 5% es +1 pp, no +25%
                    <div className="border border-line bg-card-raised p-2">
                      <p className="text-[10px] text-ink-muted">Cambio desde {formatFullDate(stats.first.date)}</p>
                      <p
                        className={`mt-0.5 text-base font-semibold ${
                          stats.last.value >= stats.first.value ? "text-up" : "text-down"
                        }`}
                      >
                        {signedPp(stats.last.value - stats.first.value)}
                      </p>
                    </div>
                  ) : (
                    <div className="border border-line bg-card-raised p-2">
                      <p
                        className="text-[10px] text-ink-muted"
                        title="Se mide desde el primer valor material del rango (al menos 1% del máximo): contra el arranque casi nulo de una serie, el porcentaje no significa nada."
                      >
                        {stats.base && stats.base.date !== stats.first.date
                          ? `Variación desde ${formatFullDate(stats.base.date)}`
                          : "Variación en el rango"}
                      </p>
                      <p
                        className={`mt-0.5 text-base font-semibold ${
                          stats.changePct === null ? "text-ink-muted" : stats.changePct >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {stats.changePct === null ? "—" : `${stats.changePct >= 0 ? "▲" : "▼"} ${signedPct(stats.changePct)}`}
                      </p>
                    </div>
                  )}
                  <div className="border border-line bg-card-raised p-2">
                    <p className="text-[10px] text-ink-muted">Máximo · {formatFullDate(stats.max.date)}</p>
                    <p className="mt-0.5 text-base font-semibold">{formatValue(stats.max.value, metric.unit)}</p>
                  </div>
                  <div className="border border-line bg-card-raised p-2">
                    <p className="text-[10px] text-ink-muted">Distancia al máximo</p>
                    <p className="mt-0.5 text-base font-semibold">
                      {metric.unit === "pct" ? signedPp(stats.last.value - stats.max.value) : signedPct(stats.fromMaxPct)}
                    </p>
                  </div>
                </div>

                {view === "chart" ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
                          width={58}
                          // magnitudes (TVL, supply) desde cero; un precio se lee por su nivel
                          domain={metric.unit === "usd" ? [0, "auto"] : ["auto", "auto"]}
                          tickFormatter={(v: number) => formatValue(v, metric.unit)}
                        />
                        <Tooltip
                          cursor={{ stroke: CHART_THEME.axis, strokeWidth: 1 }}
                          content={(props) => (
                            <ChartTooltip active={props.active} payload={props.payload} label={props.label} unit={metric.unit} />
                          )}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={SERIES}
                          strokeWidth={2}
                          fill={SERIES}
                          fillOpacity={metric.unit === "usd" ? 0.1 : 0}
                          isAnimationActive={false}
                          dot={false}
                          activeDot={{ r: 4, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
                        />
                        <ReferenceDot
                          x={stats.last.date}
                          y={stats.last.value}
                          r={4}
                          fill={SERIES}
                          stroke={SURFACE}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-auto border border-line">
                    <table className="w-full border-collapse text-[12px]">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-left text-[10px] uppercase tracking-wide text-ink-muted">
                          <th className="border-b border-line px-2 py-1.5 font-medium">Fecha</th>
                          <th className="border-b border-line px-2 py-1.5 text-right font-medium">{metric.label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...points].reverse().map((p) => (
                          <tr key={p.date} className="border-b border-line/40 last:border-0">
                            <td className="px-2 py-1 text-ink-secondary">{formatFullDate(p.date)}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{formatValue(p.value, metric.unit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-muted">
                  <span>{points.length} días en el rango</span>
                  {range === "all" && shortRange && <span>la fuente no publica más de un año para esta entidad</span>}
                  <button type="button" onClick={download} className="ml-auto text-core transition-colors hover:text-electric">
                    Exportar CSV
                  </button>
                </div>
                </>
              )}

              {/* composición: qué protocolos explican el total */}
              {composition && composition.rows.length > 1 && (
                <section className="mt-5">
                  <h3 className="mb-1 text-[13px] font-semibold">Qué lo compone</h3>
                  <p className="mb-2 text-[11px] text-ink-secondary">
                    Los mayores protocolos del sector apilados; el resto se agrupa en gris.
                  </p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={composition.rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
                          width={58}
                          domain={[0, "auto"]}
                          tickFormatter={(v: number) => formatUsdCompact(v)}
                        />
                        <Tooltip
                          cursor={{ stroke: CHART_THEME.axis, strokeWidth: 1 }}
                          content={(props) => (
                            <ChartTooltip
                              active={props.active}
                              payload={props.payload}
                              label={props.label}
                              unit="usd"
                              names={new Map(composition.series.map((s) => [s.key, { label: s.label, color: s.color }]))}
                            />
                          )}
                        />
                        {composition.series.map((s) => (
                          <Area
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            stackId="composition"
                            stroke={SURFACE}
                            strokeWidth={1.5}
                            fill={s.color}
                            fillOpacity={0.85}
                            isAnimationActive={false}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {composition.series.map((s) => (
                      <li key={s.key} className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
                        {s.label}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* miembros: cada uno abre su propio histórico */}
              {ready.members && ready.members.length > 0 && (
                <section className="mt-5">
                  <h3 className="mb-1 text-[13px] font-semibold">Protocolos del sector</h3>
                  <p className="mb-2 text-[11px] text-ink-secondary">Tocá uno para ver su histórico sin cerrar la ficha.</p>
                  <ul className="space-y-1">
                    {ready.members.map((member) => {
                      const max = ready.members![0].valueUsd || 1;
                      return (
                        <li key={member.label}>
                          <button
                            type="button"
                            disabled={!member.target}
                            onClick={() => member.target && onDrill(member.target)}
                            className="group w-full rounded px-1.5 py-1 text-left transition-colors hover:bg-ice/40 disabled:cursor-default"
                          >
                            <span className="flex items-baseline justify-between gap-2 text-[12px]">
                              <span className="min-w-0 truncate text-ink-secondary group-hover:text-ink">
                                {member.label}
                                {member.target && (
                                  <span className="ml-1.5 text-[10px] text-core opacity-0 transition-opacity group-hover:opacity-100">
                                    ver histórico ↗
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {formatUsdCompact(member.valueUsd)}
                                <span className="ml-1.5 text-[10px] text-ink-muted">{member.sharePct.toFixed(1)}%</span>
                              </span>
                            </span>
                            <span className="mt-1 block h-1.5 rounded-sm bg-ice/70">
                              <span
                                className="block h-full"
                                style={{
                                  width: `${Math.max((member.valueUsd / max) * 100, 1)}%`,
                                  background: SERIES,
                                  borderRadius: "0 4px 4px 0",
                                }}
                              />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* procedencia */}
              <footer className="mt-5 space-y-1 border-t border-line pt-3 text-[11px] text-ink-muted">
                <p>
                  Fuente:{" "}
                  {ready.sourceUrl ? (
                    <a href={ready.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-electric">
                      {ready.source}
                    </a>
                  ) : (
                    ready.source
                  )}{" "}
                  · {ready.cadence} · consultado {relative(ready.fetchedAt)}
                </p>
                {ready.stale && (
                  <p className="text-warn">Último valor válido en caché: la fuente no respondió en esta consulta.</p>
                )}
                {ready.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </footer>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
