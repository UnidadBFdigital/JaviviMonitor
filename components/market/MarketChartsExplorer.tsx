"use client";

import { useState } from "react";
import { CalendarHeatmap } from "@/components/charts/CalendarHeatmap";
import { CandleChart } from "@/components/charts/CandleChart";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { CANDLE_MARKETS, type Candle } from "@/lib/sources/cryptocom";
import { STATUS } from "@/lib/palette";
import { useSource } from "@/lib/useSource";

const PERIODS = [30, 90, 180, 300] as const;

export function MarketChartsExplorer() {
  const [asset, setAsset] = useState<(typeof CANDLE_MARKETS)[number]["symbol"]>("BTC");
  const [days, setDays] = useState<(typeof PERIODS)[number]>(90);
  const result = useSource<Candle[]>(
    `/api/market/candles?asset=${asset}&days=${days}`,
    "Crypto.com Exchange"
  );
  const market = CANDLE_MARKETS.find((item) => item.symbol === asset) ?? CANDLE_MARKETS[0];
  const returns =
    result?.ok && result.data.length > 1
      ? result.data.slice(1).map((candle, index) => {
          const previous = result.data[index].close;
          return {
            date: candle.date,
            value: previous > 0 ? ((candle.close - previous) / previous) * 100 : null,
          };
        })
      : [];
  const positives = returns.filter((day) => (day.value ?? 0) > 0).length;
  const negatives = returns.filter((day) => (day.value ?? 0) < 0).length;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-1">
      <div className="flex rounded border border-line bg-card-raised p-0.5">
        {CANDLE_MARKETS.map((item) => (
          <button
            key={item.symbol}
            type="button"
            onClick={() => setAsset(item.symbol)}
            className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
              asset === item.symbol ? "bg-electric text-white" : "text-ink-secondary hover:bg-ice"
            }`}
            title={item.name}
          >
            {item.symbol}
          </button>
        ))}
      </div>
      <div className="flex rounded border border-line bg-card-raised p-0.5">
        {PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setDays(period)}
            className={`rounded px-2 py-1 text-[10px] transition-colors ${
              days === period ? "bg-ice font-semibold text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {period}d
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <ChartFrame
        title={`${asset}/USDT · precio y rango diario`}
        subtitle={`Velas OHLC y volumen de ${market.name}; rueda para acercar, arrastre para moverse`}
        source={result?.ok ? result.source : "Crypto.com Exchange"}
        fetchedAt={result?.ok ? result.fetchedAt : undefined}
        stale={result?.ok ? result.stale : undefined}
        loading={result === null}
        error={result?.ok === false || result?.data.length === 0 ? "no disponible" : null}
        height="h-80"
        toolbar={toolbar}
        exportRows={result?.ok ? result.data : undefined}
        exportName={`${asset.toLowerCase()}-usdt-${days}d`}
      >
        {result?.ok && <CandleChart candles={result.data} baseSymbol={asset} />}
      </ChartFrame>

      <ChartFrame
        title={`Calendario de retornos · ${asset}`}
        subtitle={`Retorno diario de cierre a cierre · ventana de ${days} días (±5% satura el color)`}
        source={result?.ok ? result.source : "Crypto.com Exchange"}
        fetchedAt={result?.ok ? result.fetchedAt : undefined}
        stale={result?.ok ? result.stale : undefined}
        loading={result === null}
        error={result?.ok === false || returns.length === 0 ? "no disponible" : null}
        height="h-44"
        exportRows={returns}
        exportName={`${asset.toLowerCase()}-retornos-${days}d`}
      >
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1">
            <CalendarHeatmap
              days={returns}
              cap={5}
              formatValue={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}%`}
            />
          </div>
          <p className="mt-1 flex gap-3 text-[10px] text-ink-secondary">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: STATUS.up }} />
              {positives} días al alza
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: STATUS.down }} />
              {negatives} días a la baja
            </span>
          </p>
        </div>
      </ChartFrame>
    </div>
  );
}
