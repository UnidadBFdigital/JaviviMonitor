"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { LiveLiquidationMonitor } from "@/components/onchain/LiveLiquidationMonitor";
import type { BitcoinDerivativesData, LiquidationScenario } from "@/lib/sources/binanceFutures";
import type { BitcoinOnchainData, BitcoinOnchainPoint } from "@/lib/sources/coinmetrics";
import type { SourceResult } from "@/lib/sources/types";
import { CATEGORICAL, CHART_THEME, STATUS, TOOLTIP_STYLE } from "@/lib/palette";
import { usePayload } from "@/lib/useSource";

type Payload = {
  onchain: SourceResult<BitcoinOnchainData>;
  derivatives: SourceResult<BitcoinDerivativesData>;
  generatedAt: string;
};

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});
const compactNumber = new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 2 });

function signed(value: number | null, digits = 1) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

/** Variaciones que NO son porcentaje. El MVRV se mueve en puntos de ratio:
 *  ponerle "%" convertía +0.26 puntos en un "+0.26%" que no significa nada. */
function signedPoints(value: number | null, digits = 2) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
}

function signedBtc(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${compactNumber.format(Math.abs(value))} BTC`;
}

function signedCompactUsd(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${compactUsd.format(Math.abs(value))}`;
}

function Kpi({ label, value, detail, tone = "neutral" }: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "up" | "down" | "warn";
}) {
  const toneClass = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="min-w-0 border-l border-line px-3 first:border-l-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className={`mt-1 truncate text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-ink-secondary" title={detail}>{detail}</p>
    </div>
  );
}

function SourceLine({ result }: { result: SourceResult<unknown> }) {
  if (!result.ok) return <span className="text-down">{result.source}: sin respuesta</span>;
  return (
    <span>
      {result.source} · {new Date(result.fetchedAt).toLocaleString("es-BO")}
      {result.stale ? " · caché" : ""}
    </span>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-4">
      <div className="bf-shimmer h-28 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="bf-shimmer h-80 rounded-lg" />
        <div className="bf-shimmer h-80 rounded-lg" />
      </div>
    </div>
  );
}

function DateAxis() {
  return (
    <XAxis
      dataKey="date"
      tick={{ fontSize: 10, fill: CHART_THEME.axis }}
      tickLine={false}
      axisLine={{ stroke: CHART_THEME.grid }}
      minTickGap={44}
      tickFormatter={(date: string) => date.slice(5)}
    />
  );
}

function CostBasisChart({ rows }: { rows: BitcoinOnchainPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="btc-price-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CATEGORICAL[3]} stopOpacity={0.28} />
            <stop offset="95%" stopColor={CATEGORICAL[3]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
        <DateAxis />
        <YAxis
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => `$${Math.round(value / 1000)}k`}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, name) => [usd0.format(Number(value)), name === "priceUsd" ? "Precio BTC" : "Precio realizado"]}
        />
        <Area type="monotone" dataKey="priceUsd" stroke={CATEGORICAL[3]} fill="url(#btc-price-fill)" strokeWidth={2} connectNulls />
        <Line type="monotone" dataKey="realizedPriceUsd" stroke={CATEGORICAL[0]} strokeWidth={2} dot={false} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MvrvChart({ rows }: { rows: BitcoinOnchainPoint[] }) {
  // Las líneas de 1.0 y 2.4 entran por defecto en el cálculo del dominio de
  // recharts: con el MVRV real entre 1.10 y 2.29 eso estiraba el eje y
  // aplanaba la serie. Se fija el dominio a los datos y las referencias se
  // recortan si quedan fuera.
  const values = rows.map((row) => row.mvrv).filter((v): v is number => v !== null);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const pad = Math.max(0.05, (high - low) * 0.12);
  const domain: [number, number] = [Math.max(0, low - pad), high + pad];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="mvrv-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CATEGORICAL[6]} stopOpacity={0.28} />
            <stop offset="95%" stopColor={CATEGORICAL[6]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
        <DateAxis />
        <YAxis
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={false}
          width={38}
          domain={domain}
          allowDataOverflow
          tickFormatter={(value: number) => value.toFixed(2)}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [Number(value).toFixed(2), "MVRV"]} />
        <ReferenceLine y={1} stroke={STATUS.down} strokeDasharray="4 4" ifOverflow="hidden" label={{ value: "1.0", fill: STATUS.down, fontSize: 9 }} />
        <ReferenceLine y={2.4} stroke={STATUS.warn} strokeDasharray="4 4" ifOverflow="hidden" label={{ value: "2.4", fill: STATUS.warn, fontSize: 9 }} />
        <Area type="monotone" dataKey="mvrv" stroke={CATEGORICAL[6]} fill="url(#mvrv-fill)" strokeWidth={2} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ExchangeFlowChart({ rows }: { rows: BitcoinOnchainPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
        <DateAxis />
        <YAxis
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={(value: number) => compactUsd.format(value)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [signedCompactUsd(Number(value)), "Flujo neto"]}
          labelFormatter={(date) => String(date)}
        />
        <ReferenceLine y={0} stroke={CHART_THEME.axis} />
        {/* El signo ES el mensaje: entrada y salida no pueden compartir color. */}
        <Bar dataKey="netExchangeFlowUsd" radius={[2, 2, 0, 0]}>
          {rows.map((row) => (
            <Cell
              key={row.date}
              fill={(row.netExchangeFlowUsd ?? 0) > 0 ? STATUS.down : STATUS.up}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DerivativesChart({ data }: { data: BitcoinDerivativesData }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data.history} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={{ stroke: CHART_THEME.grid }}
          minTickGap={48}
          tickFormatter={(time: string) => new Date(time).toLocaleDateString("es-BO", { day: "2-digit", month: "short" })}
        />
        <YAxis
          yAxisId="oi"
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={false}
          width={54}
          tickFormatter={(value: number) => compactUsd.format(value)}
        />
        <YAxis
          yAxisId="ratio"
          orientation="right"
          domain={[35, 75]}
          tick={{ fontSize: 10, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={false}
          width={38}
          tickFormatter={(value: number) => `${value}%`}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, name) => {
            if (name === "openInterestUsd") return [compactUsd.format(Number(value)), "Interés abierto"];
            const labels: Record<string, string> = {
              globalLongPct: "Cuentas long",
              topTraderLongPct: "Top traders long",
              takerBuyPct: "Volumen taker buy",
            };
            return [`${Number(value).toFixed(1)}%`, labels[String(name)] ?? String(name)];
          }}
        />
        <ReferenceLine yAxisId="ratio" y={50} stroke={CHART_THEME.axis} strokeDasharray="4 4" />
        <Bar yAxisId="oi" dataKey="openInterestUsd" fill={CATEGORICAL[0]} fillOpacity={0.25} />
        <Line yAxisId="ratio" type="monotone" dataKey="globalLongPct" stroke={CATEGORICAL[2]} strokeWidth={1.8} dot={false} connectNulls />
        <Line yAxisId="ratio" type="monotone" dataKey="topTraderLongPct" stroke={CATEGORICAL[3]} strokeWidth={1.8} dot={false} connectNulls />
        <Line yAxisId="ratio" type="monotone" dataKey="takerBuyPct" stroke={CATEGORICAL[4]} strokeWidth={1.5} dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ProfitabilityPanel({ data }: { data: BitcoinOnchainData }) {
  const { snapshot, signals } = data;
  const pricePremium = snapshot.mvrv === null ? null : (snapshot.mvrv - 1) * 100;
  const profitable = signals.profitableDaysPct ?? 0;
  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">Ganancia / pérdida on-chain</h3>
        <p className="text-xs text-ink-secondary">
          Régimen agregado de costo base al cierre {data.asOf}, no conteo de personas.
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">Sobre costo realizado</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${pricePremium !== null && pricePremium >= 0 ? "text-up" : "text-down"}`}>
            {signed(pricePremium)}
          </p>
          <p className="text-[10px] text-ink-secondary">Precio de mercado vs. precio realizado</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">Ganancia no realizada</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${(snapshot.unrealizedGainUsd ?? 0) >= 0 ? "text-up" : "text-down"}`}>
            {signedCompactUsd(snapshot.unrealizedGainUsd)}
          </p>
          <p className="text-[10px] text-ink-secondary">Market cap − realized cap</p>
        </div>
      </div>
      <div className="mt-5 border-t border-line/70 pt-4">
        <p className="text-[10px] uppercase tracking-wide text-ink-muted">Referencia de precio · no on-chain</p>
        <div className="mt-1.5 flex justify-between text-[10px] text-ink-secondary">
          <span>Días de entrada rentables · 365d</span>
          <span className="font-semibold tabular-nums text-ink">{profitable.toFixed(1)}%</span>
        </div>
        <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-down/40">
          <div className="bg-up" style={{ width: `${Math.max(0, Math.min(100, profitable))}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-ink-muted">
          <span>Cierre diario bajo el precio actual</span>
          <span>{(100 - profitable).toFixed(1)}% por encima</span>
        </div>
      </div>
      <div className="mt-5 space-y-1.5 rounded border border-line/70 bg-surface/60 px-3 py-2 text-[10px] leading-relaxed text-ink-muted">
        <p>
          <span className="text-warn">Derivado: </span>
          el plan comunitario de Coin Metrics no publica <code>CapRealUSD</code>. El realized cap se
          reconstruye como <code>CapMrktCurUSD ÷ CapMVRVCur</code> y el precio realizado se divide
          entre <code>SplyCur</code>. Contrastado con bitcoin-data.com el realized cap difiere 0.02%.
        </p>
        <p>
          Los “días rentables” comparan cierres de precio, no costo base: no equivalen a oferta en
          ganancia. Una dirección puede pertenecer a varias personas o una persona a muchas
          direcciones, así que tampoco se etiqueta como “billeteras en ganancia”.
        </p>
      </div>
    </section>
  );
}

function HoldersProxyPanel({ data }: { data: BitcoinOnchainData }) {
  const { snapshot, signals } = data;
  const outsideExchanges = snapshot.exchangeSupplyPct === null ? null : 100 - snapshot.exchangeSupplyPct;
  // El saldo (stock) es la serie auditable; el flujo en USD de Coin Metrics
  // mide transferencias brutas valuadas al precio de cada día y NO cuadra con
  // la variación del saldo. Se muestran los dos, pero manda el saldo.
  const flowBtcEquivalent = signals.netExchangeFlow7dUsd !== null && snapshot.priceUsd
    ? signals.netExchangeFlow7dUsd / snapshot.priceUsd
    : null;
  // Se avisa tanto cuando el signo difiere como cuando la magnitud se separa
  // más de 2×: con datos reales las dos series discrepan casi siempre.
  const flowContradice =
    flowBtcEquivalent !== null &&
    signals.exchangeSupply7dChangeBtc !== null &&
    (Math.sign(flowBtcEquivalent) !== Math.sign(signals.exchangeSupply7dChangeBtc) ||
      Math.abs(flowBtcEquivalent) > Math.abs(signals.exchangeSupply7dChangeBtc) * 2 ||
      Math.abs(signals.exchangeSupply7dChangeBtc) > Math.abs(flowBtcEquivalent) * 2);
  const rows: { label: string; note: string; value: string; tone: string }[] = [
    {
      label: "Oferta fuera de exchanges",
      note: "Supply total menos saldo en exchanges etiquetados por Coin Metrics",
      value: outsideExchanges === null ? "—" : `${outsideExchanges.toFixed(1)}%`,
      tone: "text-ink",
    },
    {
      label: "Saldo en exchanges · 7d",
      note: "Variación del stock observado",
      value: signedBtc(signals.exchangeSupply7dChangeBtc),
      tone: (signals.exchangeSupply7dChangeBtc ?? 0) <= 0 ? "text-up" : "text-down",
    },
    {
      label: "Saldo en exchanges · 30d",
      note: "Menos BTC en exchanges suele reducir oferta líquida",
      value: signedBtc(signals.exchangeSupply30dChangeBtc),
      tone: (signals.exchangeSupply30dChangeBtc ?? 0) <= 0 ? "text-up" : "text-down",
    },
    {
      label: "Direcciones con saldo · 30d",
      note: "Direcciones, no usuarios únicos",
      value: signed(signals.addressBalance30dChangePct, 2),
      tone: (signals.addressBalance30dChangePct ?? 0) >= 0 ? "text-up" : "text-down",
    },
    {
      label: "Flujo bruto neto · 7d",
      note: "Entradas − salidas valuadas en USD; no reconcilia con el saldo",
      value: signedCompactUsd(signals.netExchangeFlow7dUsd),
      tone: "text-ink-secondary",
    },
  ];
  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Holders y acumulación</h3>
      <p className="text-xs text-ink-secondary">Proxies abiertos; no sustituyen la cohorte LTH de 155 días.</p>
      <div className="mt-4 divide-y divide-line/70">
        {rows.map((row) => (
          <div key={row.label} className="flex items-end justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-[11px] text-ink-secondary">{row.label}</p>
              <p className="text-[10px] text-ink-muted">{row.note}</p>
            </div>
            <p className={`shrink-0 text-lg font-semibold tabular-nums ${row.tone}`}>{row.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded border border-line/70 bg-surface/60 px-3 py-2 text-[10px] leading-relaxed text-ink-muted">
        {flowContradice ? (
          <>
            <span className="text-warn">Señales en conflicto: </span>
            el flujo en USD equivale a {signedBtc(flowBtcEquivalent)} en 7 días mientras el saldo
            observado se movió {signedBtc(signals.exchangeSupply7dChangeBtc)}. El flujo suma transferencias brutas
            (incluidas consolidaciones internas) valuadas al precio de cada día; el saldo es el stock.
            Para decidir, manda el saldo.
          </>
        ) : (
          <>El flujo en USD suma transferencias brutas y no cuadra con la variación del saldo: son
          medidas distintas, no dos versiones del mismo número. Para decidir, manda el saldo.</>
        )}
        {data.preliminary.length > 0 && (
          <>
            {" "}
            <span className="text-warn">Preliminar:</span> Coin Metrics marca{" "}
            <code>{data.preliminary.join(", ")}</code> del cierre {data.asOf} como “flash” (revisable).
          </>
        )}
      </div>
    </section>
  );
}

function ScenarioMap({ scenarios, markPrice }: { scenarios: LiquidationScenario[]; markPrice: number }) {
  const min = markPrice * 0.64;
  const max = markPrice * 1.36;
  const position = (price: number) => ((price - min) / (max - min)) * 100;
  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Mapa de riesgo de liquidación</h3>
          <p className="text-xs text-ink-secondary">Umbrales teóricos por apalancamiento desde el mark price.</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-wide text-ink-muted">Mark price</p>
          <p className="font-semibold tabular-nums">{usd0.format(markPrice)}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {scenarios.map((scenario) => (
          <div key={scenario.leverage} className="grid grid-cols-[42px_1fr_48px] items-center gap-2">
            <span className="text-[10px] font-semibold tabular-nums text-ink-secondary">{scenario.leverage}×</span>
            <div className="relative h-5 rounded bg-gradient-to-r from-down/20 via-ice/60 to-up/20">
              <span className="absolute inset-y-0 left-1/2 w-px bg-ink-muted/70" />
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-down bg-down"
                style={{ left: `${position(scenario.longLiquidationUsd)}%` }}
                title={`Long: ${usd0.format(scenario.longLiquidationUsd)}`}
              />
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-up bg-up"
                style={{ left: `${position(scenario.shortLiquidationUsd)}%` }}
                title={`Short: ${usd0.format(scenario.shortLiquidationUsd)}`}
              />
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[8px] tabular-nums text-ink-muted">
                {scenario.leverage === 100 ? usd0.format(markPrice) : ""}
              </span>
            </div>
            <span className="text-right text-[10px] tabular-nums text-ink-muted">±{scenario.distancePct.toFixed(scenario.leverage >= 25 ? 1 : 0)}%</span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 text-[10px]">
        <div className="rounded border border-down/30 bg-down/5 px-3 py-2">
          <p className="font-semibold text-down">◆ Longs · caída</p>
          <p className="mt-0.5 text-ink-muted">Precio ≈ entrada × (1 − 1/L)</p>
        </div>
        <div className="rounded border border-up/30 bg-up/5 px-3 py-2">
          <p className="font-semibold text-up">◆ Shorts · subida</p>
          <p className="mt-0.5 text-ink-muted">Precio ≈ entrada × (1 + 1/L)</p>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">
        Escenario de margen simple. No estima nocional acumulado y no incluye maintenance margin, comisiones ni niveles de cada cuenta.
      </p>
    </section>
  );
}

function InsightStrip({ onchain, derivatives }: { onchain: BitcoinOnchainData; derivatives: BitcoinDerivativesData | null }) {
  const costPremium = onchain.snapshot.mvrv === null ? null : (onchain.snapshot.mvrv - 1) * 100;
  // Antes esta señal salía del flujo en USD, que contradice al saldo. El stock
  // en exchanges es la serie que sí se puede auditar contra el balance.
  const supply30d = onchain.signals.exchangeSupply30dChangeBtc;
  const insights = [
    {
      label: "VALUACIÓN",
      value: costPremium === null ? "Sin señal" : costPremium > 100 ? "Prima elevada" : costPremium > 0 ? "Sobre costo base" : "Bajo costo base",
      detail: costPremium === null ? "MVRV no disponible" : `${signed(costPremium)} frente al precio realizado`,
      tone: costPremium !== null && costPremium > 140 ? "text-warn" : costPremium !== null && costPremium < 0 ? "text-down" : "text-up",
    },
    {
      label: "OFERTA LÍQUIDA",
      value: supply30d === null ? "Sin señal" : supply30d <= 0 ? "Saldo bajando" : "Saldo subiendo",
      detail: `${signedBtc(supply30d)} en exchanges · 30d`,
      tone: supply30d === null ? "text-ink" : supply30d <= 0 ? "text-up" : "text-down",
    },
    {
      label: "APALANCAMIENTO · BINANCE",
      value: derivatives?.openInterest24hChangePct === null || !derivatives ? "Sin señal" : (derivatives.openInterest24hChangePct ?? 0) >= 0 ? "OI expandiendo" : "OI contrayendo",
      detail: derivatives ? `${signed(derivatives.openInterest24hChangePct)} en 24 horas` : "Derivados no disponibles",
      tone: derivatives && Math.abs(derivatives.openInterest24hChangePct ?? 0) > 5 ? "text-warn" : "text-ink",
    },
    {
      label: "POSICIONAMIENTO · BINANCE",
      value: !derivatives || derivatives.topTraderLongPct === null ? "Sin señal" : derivatives.topTraderLongPct > 55 ? "Top traders long" : derivatives.topTraderLongPct < 45 ? "Top traders short" : "Balanceado",
      detail: derivatives?.topTraderLongPct === null || !derivatives ? "Ratio no disponible" : `${derivatives.topTraderLongPct.toFixed(1)}% de posiciones long`,
      tone: derivatives && derivatives.topTraderLongPct !== null && Math.abs(derivatives.topTraderLongPct - 50) > 15 ? "text-warn" : "text-ink",
    },
  ];
  return (
    <div className="grid grid-cols-1 divide-y divide-line overflow-hidden rounded-lg border border-line bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
      {insights.map((insight) => (
        <div key={insight.label} className="px-4 py-3">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-ink-muted">{insight.label}</p>
          <p className={`mt-1 text-sm font-semibold ${insight.tone}`}>{insight.value}</p>
          <p className="mt-0.5 text-[10px] text-ink-secondary">{insight.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function BitcoinIntelligenceDashboard() {
  const { data: payload, error } = usePayload<Payload>("/api/onchain/bitcoin-intelligence");
  const [days, setDays] = useState<90 | 180 | 365>(180);
  const onchain = payload?.onchain.ok ? payload.onchain.data : null;
  const derivatives = payload?.derivatives.ok ? payload.derivatives.data : null;
  const history = useMemo(() => onchain?.history.slice(-days) ?? [], [onchain, days]);
  const flowHistory = history.slice(-90);

  if (!payload && !error) return <LoadingDashboard />;
  if (error || !payload || (!onchain && !derivatives)) {
    return (
      <div className="rounded-lg border border-down/40 bg-down/5 p-5 text-sm text-ink-secondary">
        El dashboard de Bitcoin no pudo conectar con sus fuentes. Revisa la ruta interna y la conectividad del servidor.
      </div>
    );
  }

  const snapshot = onchain?.snapshot;
  const price = derivatives?.markPriceUsd ?? snapshot?.priceUsd ?? null;
  const mvrvTone = snapshot?.mvrv === null || snapshot?.mvrv === undefined ? "neutral" : snapshot.mvrv > 2.4 ? "warn" : snapshot.mvrv < 1 ? "down" : "up";
  const fundingTone = derivatives?.fundingRatePct === undefined ? "neutral" : Math.abs(derivatives.fundingRatePct) > 0.05 ? "warn" : derivatives.fundingRatePct >= 0 ? "up" : "down";

  return (
    <div className="space-y-4">
      <section className="bf-frame bf-reveal">
        <div className="bg-card">
          <div className="flex flex-col items-stretch gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-electric">Bitcoin intelligence</p>
              <p className="mt-0.5 text-xs text-ink-secondary">On-chain · derivados · liquidaciones · acumulación</p>
            </div>
            <div className="flex self-end items-center gap-1 rounded border border-line bg-surface p-0.5 sm:self-auto">
              {[90, 180, 365].map((range) => (
                <button
                  key={range}
                  onClick={() => setDays(range as 90 | 180 | 365)}
                  className={`rounded px-2.5 py-1 text-[10px] ${days === range ? "bg-electric text-white" : "text-ink-muted hover:text-ink"}`}
                >
                  {range}d
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-4 px-1 py-4 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi label="BTC mark" value={price === null ? "—" : usd0.format(price)} detail="Binance USD-M · tiempo real" />
            <Kpi label="Precio realizado" value={snapshot?.realizedPriceUsd === null || snapshot?.realizedPriceUsd === undefined ? "—" : usd0.format(snapshot.realizedPriceUsd)} detail={`Costo base agregado · ${onchain?.asOf ?? "—"}`} />
            <Kpi label="MVRV" value={snapshot?.mvrv === null || snapshot?.mvrv === undefined ? "—" : `${snapshot.mvrv.toFixed(2)}×`} detail={`${signedPoints(onchain?.signals.mvrv30dChange ?? null)} pts en 30d · cierre ${onchain?.asOf ?? "—"}`} tone={mvrvTone} />
            <Kpi label="OI · Binance BTCUSDT" value={derivatives?.openInterestUsd === null || derivatives?.openInterestUsd === undefined ? "—" : compactUsd.format(derivatives.openInterestUsd)} detail={`${signed(derivatives?.openInterest24hChangePct ?? null)} en 24h · un solo exchange`} tone={Math.abs(derivatives?.openInterest24hChangePct ?? 0) > 5 ? "warn" : "neutral"} />
            <Kpi label="Funding · 8h" value={derivatives ? signed(derivatives.fundingRatePct, 4) : "—"} detail={derivatives ? `${signed(derivatives.fundingAnnualizedPct)} anualizado simple` : "Sin derivados"} tone={fundingTone} />
            <Kpi label="Saldo exchanges" value={snapshot?.exchangeSupplyPct === null || snapshot?.exchangeSupplyPct === undefined ? "—" : `${snapshot.exchangeSupplyPct.toFixed(1)}%`} detail={snapshot?.exchangeSupplyBtc === null || snapshot?.exchangeSupplyBtc === undefined ? "—" : `${compactNumber.format(snapshot.exchangeSupplyBtc)} BTC · exchanges etiquetados`} />
          </div>
        </div>
      </section>

      {onchain && <InsightStrip onchain={onchain} derivatives={derivatives} />}

      {onchain && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartFrame
            title="Precio vs. costo base realizado"
            subtitle={`${days} días · mercado frente al costo agregado de las monedas`}
            source={payload.onchain.ok ? payload.onchain.source : undefined}
            fetchedAt={payload.onchain.ok ? payload.onchain.fetchedAt : undefined}
            stale={payload.onchain.ok ? payload.onchain.stale : undefined}
            height="h-72"
            exportRows={history}
            exportName="btc-price-realized-price"
          >
            <CostBasisChart rows={history} />
          </ChartFrame>
          <ChartFrame
            title="MVRV · régimen de ganancia"
            subtitle="1× = mercado al costo realizado · 2.4× = zona de vigilancia · escala ajustada al rango real"
            source={payload.onchain.ok ? payload.onchain.source : undefined}
            fetchedAt={payload.onchain.ok ? payload.onchain.fetchedAt : undefined}
            stale={payload.onchain.ok ? payload.onchain.stale : undefined}
            height="h-72"
            exportRows={history}
            exportName="btc-mvrv"
          >
            <MvrvChart rows={history} />
          </ChartFrame>
        </div>
      )}

      {derivatives && price !== null && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ScenarioMap scenarios={derivatives.liquidationScenarios} markPrice={price} />
          <LiveLiquidationMonitor markPrice={price} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {onchain && <ProfitabilityPanel data={onchain} />}
        {onchain && <HoldersProxyPanel data={onchain} />}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {onchain && (
          <ChartFrame
            title="Flujo bruto hacia exchanges"
            subtitle="Transferencias entrantes − salientes en USD · mide movimiento, no el saldo"
            source={payload.onchain.ok ? payload.onchain.source : undefined}
            fetchedAt={payload.onchain.ok ? payload.onchain.fetchedAt : undefined}
            stale={payload.onchain.ok ? payload.onchain.stale : undefined}
            height="h-72"
            exportRows={flowHistory}
            exportName="btc-exchange-netflow"
          >
            <ExchangeFlowChart rows={flowHistory} />
          </ChartFrame>
        )}
        {derivatives && (
          <ChartFrame
            title="Apalancamiento y posicionamiento"
            subtitle="Binance USD-M BTCUSDT · OI, cuentas long, top traders y taker buy · 7 días"
            source={payload.derivatives.ok ? payload.derivatives.source : undefined}
            fetchedAt={payload.derivatives.ok ? payload.derivatives.fetchedAt : undefined}
            stale={payload.derivatives.ok ? payload.derivatives.stale : undefined}
            height="h-72"
            exportRows={derivatives.history}
            exportName="btc-derivatives-positioning"
          >
            <DerivativesChart data={derivatives} />
          </ChartFrame>
        )}
      </div>

      <div className="border-t border-line pt-3 text-[10px] leading-relaxed text-ink-muted">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <SourceLine result={payload.onchain} />
          <SourceLine result={payload.derivatives} />
          <span>Liquidaciones live: Bybit WebSocket</span>
        </div>
        <p className="mt-2 max-w-4xl">
          <span className="font-semibold text-ink-secondary">Cómo leer las vintages: </span>
          el bloque on-chain es el cierre diario de Coin Metrics
          {onchain ? ` (${onchain.asOf})` : ""}; mark price, OI, funding y posicionamiento son de
          Binance en tiempo real. Por eso el MVRV mostrado no es exactamente{" "}
          <em>mark ÷ precio realizado</em>: usa el precio de cierre de la misma fecha que el realized
          cap. Realized cap y precio realizado se derivan de{" "}
          <code>CapMrktCurUSD ÷ CapMVRVCur</code> porque el plan comunitario no expone{" "}
          <code>CapRealUSD</code>. Los datos de derivados son de un único exchange, no agregados de
          mercado.
        </p>
      </div>
    </div>
  );
}
