"use client";

import { ChartFrame } from "@/components/charts/ChartFrame";
import { CandleChart } from "@/components/charts/CandleChart";
import { useSource } from "@/lib/useSource";
import type { Candle } from "@/lib/sources/cryptocom";

export function BtcPriceChart() {
  const result = useSource<Candle[]>("/api/market/btc-candles", "Crypto.com Exchange");

  return (
    <ChartFrame
      title="BTC/USDT"
      subtitle="Velas diarias (OHLC) y volumen — últimos 90 días. Rueda para acercar, arrastre para moverse"
      source={result?.ok ? result.source : "Crypto.com Exchange"}
      fetchedAt={result?.ok ? result.fetchedAt : undefined}
      stale={result?.ok ? result.stale : undefined}
      loading={result === null}
      error={result?.ok === false ? "no disponible" : null}
      height="h-80"
      exportRows={result?.ok ? result.data : undefined}
      exportName="btc-velas-diarias"
    >
      {result?.ok && <CandleChart candles={result.data} baseSymbol="BTC" />}
    </ChartFrame>
  );
}
