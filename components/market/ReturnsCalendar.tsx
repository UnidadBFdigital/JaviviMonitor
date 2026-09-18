"use client";

import { ChartFrame } from "@/components/charts/ChartFrame";
import { CalendarHeatmap } from "@/components/charts/CalendarHeatmap";
import { useSource } from "@/lib/useSource";
import { STATUS } from "@/lib/palette";
import type { Candle } from "@/lib/sources/cryptocom";

// Retorno diario de cierre a cierre, un cuadro por día.
export function ReturnsCalendar() {
  const result = useSource<Candle[]>("/api/market/btc-candles", "Crypto.com Exchange");

  const days =
    result?.ok && result.data.length > 1
      ? result.data.slice(1).map((c, i) => {
          const prev = result.data[i].close;
          return { date: c.date, value: prev > 0 ? ((c.close - prev) / prev) * 100 : null };
        })
      : [];

  const positivos = days.filter((d) => (d.value ?? 0) > 0).length;
  const negativos = days.filter((d) => (d.value ?? 0) < 0).length;

  return (
    <ChartFrame
      title="Calendario de retornos — BTC"
      subtitle="Retorno diario de cierre a cierre · verde positivo, rojo negativo (±5% satura)"
      source={result?.ok ? result.source : "Crypto.com Exchange"}
      fetchedAt={result?.ok ? result.fetchedAt : undefined}
      stale={result?.ok ? result.stale : undefined}
      loading={result === null}
      error={result?.ok === false || days.length === 0 ? "no disponible" : null}
      height="h-40"
      exportRows={days}
      exportName="btc-retornos-diarios"
    >
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <CalendarHeatmap days={days} cap={5} formatValue={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`} />
        </div>
        <p className="mt-1 flex gap-3 text-[10px] text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: STATUS.up }} />
            {positivos} días al alza
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: STATUS.down }} />
            {negativos} días a la baja
          </span>
        </p>
      </div>
    </ChartFrame>
  );
}
