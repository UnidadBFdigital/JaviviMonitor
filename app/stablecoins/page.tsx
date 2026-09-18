"use client";

import { useMemo } from "react";
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
import { DonutChart } from "@/components/charts/DonutChart";
import { TreemapChart } from "@/components/charts/TreemapChart";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { WaterfallChart } from "@/components/charts/WaterfallChart";
import { formatUsdCompact, formatPct, formatTimestamp } from "@/lib/format";
import { CATEGORICAL, CHART_THEME, TOOLTIP_STYLE } from "@/lib/palette";
import type {
  Stablecoin,
  StablecoinTotal,
  IssuerSupplyPoint,
} from "@/lib/sources/stablecoins";
import type { SourceResult } from "@/lib/sources/types";
import { PageHeader } from "@/components/PageHeader";
import { StablecoinFocus } from "@/components/stablecoins/StablecoinFocus";
import { usePayload } from "@/lib/useSource";
import { useHistory } from "@/components/history/HistoryProvider";

type Payload = {
  list: SourceResult<Stablecoin[]>;
  byIssuer: SourceResult<{ series: IssuerSupplyPoint[]; issuers: string[] }>;
  total: SourceResult<StablecoinTotal>;
};

// El color sigue al emisor por su posición en el ranking completo, así el
// chip de la tabla coincide con el donut y el área apilada.
function stablecoinColumns(all: Stablecoin[]): Column<Stablecoin>[] {
  const colorOf = new Map(all.map((s, i) => [s.symbol, CATEGORICAL[i % CATEGORICAL.length]]));
  return [
    {
      key: "symbol",
      header: "Stablecoin",
      value: (s) => s.symbol,
      required: true,
      render: (s) => (
        <>
          <span
            className="mr-2 inline-block h-2 w-2 rounded-sm align-middle"
            style={{ background: colorOf.get(s.symbol) }}
          />
          <span className="font-medium">{s.symbol}</span>
          <span className="ml-2 text-[10px] text-ink-muted">{s.name}</span>
        </>
      ),
    },
    { key: "peg", header: "Mecanismo", value: (s) => s.pegMechanism },
    {
      key: "circ",
      header: "Circulante",
      value: (s) => s.circulatingUsd,
      numeric: true,
      render: (s) => formatUsdCompact(s.circulatingUsd),
    },
    {
      key: "d7",
      header: "7d",
      value: (s) => s.change7dPct,
      numeric: true,
      render: (s) => (
        <span className={(s.change7dPct ?? 0) >= 0 ? "text-up" : "text-down"}>
          {formatPct(s.change7dPct)}
        </span>
      ),
    },
    {
      key: "chains",
      header: "Chains (top)",
      value: (s) => s.chains.slice(0, 3).map((c) => c.chain).join(", "),
      align: "right",
    },
  ];
}

export default function StablecoinsPage() {
  const { data, error } = usePayload<Payload>("/api/stablecoins");
  const history = useHistory();

  const list = data?.list;
  const byIssuer = data?.byIssuer;
  const total = data?.total.ok ? data.total.data : null;
  const top = list?.ok ? list.data[0] : null;
  // memoizado: es dependencia de los useMemo de abajo y un array nuevo por
  // render los recalcularía siempre
  const issuers = useMemo(
    () => (byIssuer?.ok ? byIssuer.data.issuers : []),
    [byIssuer]
  );

  // Dominancia: mismas series normalizadas a 100% por fecha.
  const dominance = useMemo(() => {
    if (!byIssuer?.ok) return [];
    return byIssuer.data.series.map((row) => {
      const total = issuers.reduce((s, k) => s + Number(row[k] ?? 0), 0) || 1;
      const out: Record<string, string | number> = { date: String(row.date) };
      for (const k of issuers) out[k] = (Number(row[k] ?? 0) / total) * 100;
      return out;
    });
  }, [byIssuer, issuers]);

  // Waterfall: variación de circulante de cada emisor en los últimos 30 días.
  const waterfall = useMemo(() => {
    if (!byIssuer?.ok) return [];
    const series = byIssuer.data.series;
    if (series.length < 31) return [];
    const now = series[series.length - 1];
    const prev = series[series.length - 31];
    return issuers.map((k) => ({
      name: k,
      delta: Number(now[k] ?? 0) - Number(prev[k] ?? 0),
    }));
  }, [byIssuer, issuers]);

  return (
    <div className="space-y-4">
      <div>
        <PageHeader
          eyebrow="Institutional Intelligence"
          title="Stablecoin Intelligence"
          subtitle="Supply circulante por emisor, participación de mercado y distribución por chain, más los frentes donde se decide la adopción: pagos, banca y regulación."
        />
      </div>

      {total && (
        <section className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-card p-4 lg:grid-cols-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
              Market cap oficial
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatUsdCompact(total.totalUsd)}</p>
            <p className="text-[10px] text-ink-muted">sin activos doublecounted</p>
            <button
              type="button"
              onClick={() => history.open({ kind: "stablecoin-total", id: "total", label: "Stablecoins" })}
              className="mt-1 text-[11px] text-core transition-colors hover:text-electric"
            >
              Histórico desde 2017 ↗
            </button>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
              Cambio 7d
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${
              (total.change7dPct ?? 0) >= 0 ? "text-up" : "text-down"
            }`}>
              {formatPct(total.change7dPct)}
            </p>
            <p className="text-[10px] text-ink-muted">dashboard oficial</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
              Dominancia
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {total.dominancePct?.toFixed(2) ?? "—"}%
            </p>
            <p className="text-[10px] text-ink-muted">{total.dominantSymbol ?? "líder"}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
              Desglose por red
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {total.chainCoveragePct.toFixed(1)}%
            </p>
            <p className="text-[10px] text-ink-muted">{total.chainCount} redes atribuidas</p>
          </div>
        </section>
      )}

      <StablecoinFocus />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <ChartFrame
          title="Supply por emisor"
          subtitle="Circulante apilado de los principales emisores — últimos 6 meses"
          source={byIssuer?.ok ? byIssuer.source : "DeFiLlama Stablecoins"}
          fetchedAt={byIssuer?.ok ? byIssuer.fetchedAt : undefined}
          stale={byIssuer?.ok ? byIssuer.stale : undefined}
          loading={!data && !error}
          error={error || byIssuer?.ok === false ? "no disponible" : null}
          height="h-72"
          exportRows={byIssuer?.ok ? byIssuer.data.series : undefined}
          exportName="stablecoin-supply-por-emisor"
        >
          {byIssuer?.ok && (
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={byIssuer.data.series}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  >
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
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value, name) => [formatUsdCompact(Number(value)), String(name)]}
                    />
                    {issuers.map((sym, i) => (
                      <Area
                        key={sym}
                        type="monotone"
                        dataKey={sym}
                        stackId="supply"
                        stroke={CATEGORICAL[i]}
                        strokeWidth={1}
                        fill={CATEGORICAL[i]}
                        fillOpacity={0.72}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                {issuers.map((sym, i) => (
                  <li key={sym} className="flex items-center gap-1.5 text-ink-secondary">
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ background: CATEGORICAL[i] }}
                    />
                    {sym}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartFrame>

        <ChartFrame
          title="Market share"
          subtitle="Participación por emisor (circulante)"
          source={list?.ok ? list.source : "DeFiLlama Stablecoins"}
          fetchedAt={list?.ok ? list.fetchedAt : undefined}
          loading={!data && !error}
          error={error || list?.ok === false ? "no disponible" : null}
          height="h-72"
          exportRows={
            list?.ok
              ? list.data.map((s) => ({ symbol: s.symbol, circulatingUsd: s.circulatingUsd }))
              : undefined
          }
          exportName="stablecoin-share"
        >
          {list?.ok && (
            <DonutChart
              items={list.data.map((s) => ({ name: s.symbol, value: s.circulatingUsd }))}
              formatValue={formatUsdCompact}
            />
          )}
        </ChartFrame>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartFrame
          title="Dominancia por emisor"
          subtitle="Participación relativa del supply (100% apilado) — últimos 6 meses"
          source={byIssuer?.ok ? byIssuer.source : "DeFiLlama Stablecoins"}
          fetchedAt={byIssuer?.ok ? byIssuer.fetchedAt : undefined}
          loading={!data && !error}
          error={error || byIssuer?.ok === false ? "no disponible" : null}
          height="h-64"
          exportRows={dominance}
          exportName="dominancia-stablecoins"
        >
          {byIssuer?.ok && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dominance} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
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
                  width={42}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [`${Number(value).toFixed(1)}%`, String(name)]}
                />
                {issuers.map((sym, i) => (
                  <Area
                    key={sym}
                    type="monotone"
                    dataKey={sym}
                    stackId="dom"
                    stroke={CATEGORICAL[i]}
                    strokeWidth={1}
                    fill={CATEGORICAL[i]}
                    fillOpacity={0.72}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        <ChartFrame
          title="Cambio de supply por emisor (30d)"
          subtitle="Contribución de cada emisor a la variación neta del circulante"
          source={byIssuer?.ok ? byIssuer.source : "DeFiLlama Stablecoins"}
          fetchedAt={byIssuer?.ok ? byIssuer.fetchedAt : undefined}
          loading={!data && !error}
          error={error || waterfall.length === 0 ? "no disponible" : null}
          height="h-64"
          exportRows={waterfall}
          exportName="cambio-supply-30d"
        >
          <WaterfallChart items={waterfall} totalLabel="Neto" formatValue={formatUsdCompact} />
        </ChartFrame>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_3fr]">
        <ChartFrame
          title={top ? `Distribución por chain — ${top.symbol}` : "Distribución por chain"}
          subtitle="Circulante del stablecoin líder por blockchain"
          source={list?.ok ? list.source : "DeFiLlama Stablecoins"}
          fetchedAt={list?.ok ? list.fetchedAt : undefined}
          loading={!data && !error}
          error={error || !top ? "no disponible" : null}
          height="h-72"
          exportRows={top?.chains}
          exportName="stablecoin-chains"
        >
          {top && (
            <TreemapChart
              mode="categorical"
              items={top.chains.map((c) => ({ name: c.chain, value: c.circulatingUsd }))}
              formatValue={formatUsdCompact}
            />
          )}
        </ChartFrame>

        <section className="rounded-lg border border-line bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Comparación de emisores</h3>
          {!data && !error && <div className="h-64 animate-pulse rounded bg-ice/50" />}
          {(error || list?.ok === false) && (
            <p className="py-8 text-center text-sm text-ink-muted">Dato no disponible.</p>
          )}
          {list?.ok && (
            <>
              <DataTable
                rows={list.data}
                columns={stablecoinColumns(list.data)}
                exportName="stablecoins"
                initialSort={{ key: "circ", dir: "desc" }}
                rowHistory={(s) => ({ kind: "stablecoin", id: s.id, label: `${s.symbol} · ${s.name}` })}
              />
              <p className="mt-2 text-[10px] text-ink-muted">
                Fuente: {list.source} · consultado {formatTimestamp(list.fetchedAt)}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
