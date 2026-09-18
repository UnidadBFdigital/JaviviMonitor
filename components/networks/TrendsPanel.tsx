"use client";

import { useEffect, useState } from "react";
import { CATEGORICAL } from "@/lib/palette";
import { fetchShared } from "@/lib/fetchShared";
import { formatUsdCompact } from "@/lib/format";
import type { NetworkMetrics } from "@/lib/networks/types";
import type { NetworkPricesPayload } from "@/lib/networks/prices";
import { indexToBase100 } from "@/lib/networks/series";
import { formatValue } from "@/components/history/historyFormat";
import { Info } from "./atoms";
import { TrendLines, type TrendSeries } from "./TrendLines";
import { useIntel } from "./useNetworkIntel";

// Series de red en el tiempo. Reemplaza a la lectura de "una cifra de hoy":
// la pregunta de infraestructura no es cuánta actividad hay, sino hacia dónde
// va y desde cuándo. Ocho redes a la vez como máximo —más líneas en un mismo
// eje dejan de leerse— y la leyenda enciende y apaga cada una.

type Prices = NetworkPricesPayload["series"];

type MetricOption = {
  id: string;
  label: string;
  definition: string;
  log: boolean;
  format: (value: number) => string;
  series: (network: NetworkMetrics, prices: Prices | null) => { date: string; value: number }[];
  /** qué redes entran en las ocho: por defecto, las de mayor valor reciente */
  rank?: (network: NetworkMetrics) => number | null;
  source: string;
};

const lastValue = (points: { value: number }[]) => (points.length > 0 ? points[points.length - 1].value : null);

const METRICS: MetricOption[] = [
  {
    id: "tvl",
    label: "TVL",
    definition: "Capital depositado en los protocolos DeFi de la red, día a día.",
    log: true,
    format: (v) => formatUsdCompact(v),
    series: (n) => n.history.tvl,
    source: "DeFiLlama · serie diaria de 90 días",
  },
  {
    id: "price",
    label: "Precio del token",
    definition:
      "Precio diario del token que DeFiLlama asocia a cada red. En una L2 puede ser de gobernanza y no el que paga el gas; las redes sin token propio quedan fuera. Con «Base 100» se compara cuánto subió cada uno.",
    log: true,
    format: (v) => formatValue(v, "price"),
    series: (n, prices) => prices?.[n.id]?.points ?? [],
    // un precio no dice tamaño: entran las ocho redes con más TVL
    rank: (n) => lastValue(n.history.tvl),
    source: "CoinGecko · serie diaria de 90 días",
  },
  {
    id: "daa",
    label: "Direcciones activas · solo EVM",
    definition:
      "Direcciones que operaron cada día. growthepie publica esta serie solo para Ethereum y sus L2; las demás redes no aparecen en este gráfico. Incluye automatización; no equivale a personas únicas.",
    log: true,
    format: (v) => new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 1 }).format(v),
    series: (n) => n.history.daa,
    source: "growthepie · serie diaria de 90 días · solo Ethereum y L2",
  },
];

type PricesState = { payload: NetworkPricesPayload | null; error: boolean };

export function TrendsPanel() {
  const { rows } = useIntel();
  const [metric, setMetric] = useState<MetricOption>(METRICS[0]);
  // base 100 responde "quién creció más"; absoluto responde "quién es más grande"
  const [indexed, setIndexed] = useState(false);
  const [prices, setPrices] = useState<PricesState>({ payload: null, error: false });

  // los precios se piden recién cuando alguien elige la métrica
  const wantsPrices = metric.id === "price";
  useEffect(() => {
    if (!wantsPrices) return;
    let alive = true;
    fetchShared<NetworkPricesPayload>("/api/networks/prices")
      .then((payload) => alive && setPrices({ payload, error: false }))
      .catch(() => alive && setPrices({ payload: null, error: true }));
    return () => {
      alive = false;
    };
  }, [wantsPrices]);

  const priceSeries = prices.payload?.series ?? null;

  // se grafican las ocho con mayor valor reciente: el resto quedaría como
  // líneas planas contra el eje y solo agregaría ruido
  const withSeries = rows
    .map((row) => {
      const points = metric.series(row.network, priceSeries);
      return { row, points, order: metric.rank ? metric.rank(row.network) : lastValue(points) };
    })
    .filter((entry) => entry.points.length > 1);
  const ranked = [...withSeries].sort((a, b) => (b.order ?? 0) - (a.order ?? 0)).slice(0, 8);

  const series: TrendSeries[] = ranked.map((entry, i) => ({
    id: entry.row.network.id,
    name:
      metric.id === "price" && priceSeries?.[entry.row.network.id]?.symbol
        ? `${entry.row.network.name} · ${priceSeries[entry.row.network.id].symbol}`
        : entry.row.network.name,
    color: CATEGORICAL[i % CATEGORICAL.length],
    points: indexed ? indexToBase100(entry.points) : entry.points,
  }));

  // sin serie de verdad, no las que quedaron fuera de las ocho graficadas
  const missing = rows.length - withSeries.length;
  const pricesLoading = wantsPrices && !prices.payload && !prices.error;
  const withoutToken = wantsPrices ? (prices.payload?.missing ?? []) : [];

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash" aria-hidden />
          Evolución de la red
          <Info text={metric.definition} />
        </h3>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setIndexed(!indexed)}
            aria-pressed={indexed}
            title="Cada red arranca en 100: compara crecimiento relativo en vez de tamaño."
            className={`mr-2 rounded border px-2 py-1 text-[11px] transition-colors ${
              indexed
                ? "border-gold bg-gold/10 text-gold-bright"
                : "border-line text-ink-secondary hover:border-gold/50 hover:text-ink"
            }`}
          >
            Base 100
          </button>
          {METRICS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMetric(option)}
              aria-pressed={metric.id === option.id}
              className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                metric.id === option.id
                  ? "border-electric bg-electric/10 text-ink"
                  : "border-line text-ink-secondary hover:border-electric/60 hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <TrendLines
        series={series}
        log={indexed ? false : metric.log}
        formatValue={indexed ? (v) => v.toFixed(0) : metric.format}
        height={280}
        emptyLabel={
          pricesLoading
            ? "Consultando precios en CoinGecko…"
            : wantsPrices && prices.error
              ? "CoinGecko no respondió: no hay series de precio para mostrar."
              : undefined
        }
      />

      <p className="mt-2 text-[10px] text-ink-muted">
        {metric.source} ·{" "}
        {indexed
          ? "cada red indexada a 100 en su primer día con dato: la pendiente es crecimiento relativo"
          : "escala logarítmica para comparar magnitudes distintas en el mismo eje"}
        {wantsPrices && " · entran las ocho redes con más TVL, no los precios más altos"}
        {!pricesLoading && missing > 0 && ` · ${missing} ${missing === 1 ? "red" : "redes"} sin serie para esta métrica`}
        {withoutToken.length > 0 &&
          ` (${withoutToken.map((m) => `${m.name}: ${m.reason}`).join("; ")})`}
      </p>
    </section>
  );
}
