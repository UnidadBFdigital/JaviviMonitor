"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePayload } from "@/lib/useSource";
import { useHistory } from "@/components/history/HistoryProvider";
import { formatUsdCompact, formatPct } from "@/lib/format";
import { CHART_THEME, TOOLTIP_STYLE } from "@/lib/palette";
import type { Stablecoin, StablecoinTotal, SupplyPoint } from "@/lib/sources/stablecoins";
import type { SourceResult } from "@/lib/sources/types";

type Payload = {
  list: SourceResult<Stablecoin[]>;
  history: SourceResult<SupplyPoint[]>;
  total: SourceResult<StablecoinTotal>;
};

// Market cap total de stablecoins a un año. Es el proxy más directo de demanda de
// dólar digital, que es la tesis de fondo del negocio en mercados con
// restricción cambiaria.
export function StablecoinSupplyCard() {
  const { data, error } = usePayload<Payload>("/api/stablecoins");
  const history = useHistory();

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold"><span className="bf-slash" aria-hidden />Market cap de stablecoins · 365 días</h3>
      <span className="flex items-baseline gap-3">
        <button
          type="button"
          onClick={() => history.open({ kind: "stablecoin-total", id: "total", label: "Stablecoins" })}
          className="text-[11px] text-core transition-colors hover:text-electric"
        >
          Histórico completo ↗
        </button>
        <Link href="/stablecoins" className="text-[11px] text-core underline hover:text-electric">
          Stablecoin Intelligence →
        </Link>
      </span>
    </div>
  );

  if (error)
    return (
      <section className="bf-reveal">
        {header}
        <p className="py-6 text-sm text-ink-muted">No disponible.</p>
      </section>
    );

  if (!data)
    return (
      <section className="bf-reveal">
        {header}
        <div className="bf-shimmer mt-3 h-72 rounded" />
      </section>
    );

  if (!data.history.ok || data.history.data.length < 30)
    return (
      <section className="bf-reveal">
        {header}
        <p className="py-6 text-sm text-ink-muted">Serie no disponible.</p>
      </section>
    );

  const serie = data.history.data;
  // Cabecera y serie usan exactamente el mismo universo oficial de DeFiLlama.
  const hoy = data.total.ok ? data.total.data.totalUsd : serie[serie.length - 1].totalUsd;
  const serieHoy = serie[serie.length - 1].totalUsd;
  const hace30 = serie[Math.max(0, serie.length - 31)].totalUsd;
  const hace365 = serie[0].totalUsd;
  const ch30 = data.total.ok
    ? data.total.data.change30dPct
    : hace30 > 0
      ? ((serieHoy - hace30) / hace30) * 100
      : null;
  const ch365 = hace365 > 0 ? ((serieHoy - hace365) / hace365) * 100 : null;

  return (
    <section className="bf-reveal">
      {header}

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-2xl font-bold tabular-nums leading-none">{formatUsdCompact(hoy)}</p>
        {ch30 !== null && (
          <span className={`text-xs tabular-nums ${ch30 >= 0 ? "text-up" : "text-down"}`}>
            {formatPct(ch30)} 30d
          </span>
        )}
        {ch365 !== null && (
          <span className={`text-xs tabular-nums ${ch365 >= 0 ? "text-up" : "text-down"}`}>
            {formatPct(ch365)} 12m
          </span>
        )}
      </div>

      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="supplyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2f66ff" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#2f66ff" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: CHART_THEME.axis }}
              tickLine={false}
              axisLine={{ stroke: CHART_THEME.grid }}
              minTickGap={56}
              tickFormatter={(d: string) => d.slice(0, 7)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: CHART_THEME.axis }}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={["dataMin * 0.95", "dataMax * 1.02"]}
              tickFormatter={(v: number) => formatUsdCompact(v)}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [formatUsdCompact(Number(v)), "Market cap oficial"]}
            />
            <Area
              type="monotone"
              dataKey="totalUsd"
              stroke="#2f66ff"
              strokeWidth={1.8}
              fill="url(#supplyFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {data.list.ok && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line/60 pt-3 sm:grid-cols-3">
          {data.list.data.slice(0, 6).map((s) => (
            <button
              type="button"
              key={s.symbol}
              onClick={() => history.open({ kind: "stablecoin", id: s.id, label: `${s.symbol} · ${s.name}` })}
              title={`Ver histórico del supply de ${s.symbol}`}
              className="group flex items-baseline justify-between gap-2 rounded px-1 text-left text-[12px] transition-colors hover:bg-ice/30"
            >
              <span className="truncate text-ink-secondary group-hover:text-ink">
                {s.symbol}
                <span className="ml-1 text-[10px] text-core opacity-0 transition-opacity group-hover:opacity-100">↗</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatUsdCompact(s.circulatingUsd)}
                <span
                  className={`ml-1.5 text-[10px] ${
                    (s.change7dPct ?? 0) >= 0 ? "text-up" : "text-down"
                  }`}
                >
                  {formatPct(s.change7dPct)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
        Total y serie extraídos del dashboard oficial de DeFiLlama. Excluyen activos marcados como{" "}
        <code className="rounded bg-ice px-1">doublecounted</code> y no suman el supply bruto de{" "}
        <code className="rounded bg-ice px-1">/stablecoincharts/all</code>.{" "}
        {data.total.ok && data.total.data.dominantSymbol && (
          <>
            Dominancia {data.total.data.dominantSymbol}:{" "}
            {data.total.data.dominancePct?.toFixed(2) ?? "—"}%.
          </>
        )}
      </p>
    </section>
  );
}
