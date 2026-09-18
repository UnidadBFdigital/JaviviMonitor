"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { registerCanvasChart } from "@/lib/chartExport";
import { CHART_THEME, STATUS } from "@/lib/palette";

// Velas con lightweight-charts (TradingView): zoom con la rueda, arrastre,
// cruceta con precio y fecha en los ejes, y volumen debajo. Dibuja en canvas,
// así que los colores salen de la paleta en hex, no de variables CSS.
//
// La librería exige atribución a TradingView (licencia Apache-2.0 con NOTICE):
// el logo por defecto queda activado.

export type Ohlc = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** volumen en la moneda base; sin dato, el panel de volumen no se dibuja */
  volume?: number | null;
};

function formatPrice(value: number): string {
  if (value >= 1_000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 10) return `$${value.toFixed(2)}`;
  if (value >= 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(value >= 0.1 ? 4 : 6)}`;
}

// mismo separador que el precio del eje ($80,803): 1,291 BTC, no 1.291
function formatVolume(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 100 ? 0 : 2 });
}

/** mismo color que la vela, más tenue: el volumen acompaña, no compite */
const fade = (hex: string) => `${hex}66`;

export function CandleChart({ candles, baseSymbol }: { candles: Ohlc[]; baseSymbol?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<Ohlc | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el || candles.length === 0) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: CHART_THEME.axis,
        fontSize: 11,
        fontFamily: getComputedStyle(el).fontFamily,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: CHART_THEME.grid },
        horzLines: { color: CHART_THEME.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: CHART_THEME.grid },
      timeScale: { borderColor: CHART_THEME.grid, fixLeftEdge: true, fixRightEdge: true },
      localization: { locale: "es-BO", priceFormatter: formatPrice },
    });

    const price = chart.addSeries(CandlestickSeries, {
      upColor: STATUS.up,
      downColor: STATUS.down,
      wickUpColor: STATUS.up,
      wickDownColor: STATUS.down,
      borderVisible: false,
    });
    price.setData(
      candles.map((c) => ({ time: c.date, open: c.open, high: c.high, low: c.low, close: c.close }))
    );

    const withVolume = candles.filter((c) => typeof c.volume === "number" && c.volume > 0);
    if (withVolume.length > 0) {
      // escala propia superpuesta en el quinto inferior; las velas dejan ese espacio libre
      const volume = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        priceFormat: { type: "custom", formatter: formatVolume },
        lastValueVisible: false,
        priceLineVisible: false,
      });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      price.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.24 } });
      volume.setData(
        withVolume.map((c) => ({
          time: c.date,
          value: c.volume as number,
          color: fade(c.close >= c.open ? STATUS.up : STATUS.down),
        }))
      );
    }

    chart.timeScale().fitContent();

    const byDate = new Map(candles.map((c) => [c.date, c]));
    const onMove = (param: MouseEventParams<Time>) => {
      setHovered(typeof param.time === "string" ? (byDate.get(param.time) ?? null) : null);
    };
    chart.subscribeCrosshairMove(onMove);
    // el botón PNG del marco usa la captura de la librería (sin cruceta)
    const unregister = registerCanvasChart(el, () => chart.takeScreenshot(true, false));

    return () => {
      unregister();
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
    };
  }, [candles]);

  if (candles.length === 0) return null;

  // sin cursor encima (o con una vela de otro activo tras cambiar el selector)
  // la leyenda muestra la última vela
  const shown = hovered && candles.includes(hovered) ? hovered : candles[candles.length - 1];
  const index = candles.indexOf(shown);
  const previous = index > 0 ? candles[index - 1].close : null;
  const change = previous ? ((shown.close - previous) / previous) * 100 : null;
  const up = shown.close >= shown.open;

  return (
    <div className="relative h-full w-full">
      <div
        ref={container}
        data-canvas-chart
        className="h-full w-full"
        role="img"
        aria-label={`Velas diarias: ${candles.length} días, de ${candles[0].date} a ${candles[candles.length - 1].date}. Último cierre ${formatPrice(candles[candles.length - 1].close)}.`}
      />
      <div className="pointer-events-none absolute left-2 top-1 z-10 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-ink-secondary">
        <span className="font-semibold text-ink">{shown.date}</span>
        <span>Ap {formatPrice(shown.open)}</span>
        <span>Máx {formatPrice(shown.high)}</span>
        <span>Mín {formatPrice(shown.low)}</span>
        <span className={up ? "text-up" : "text-down"}>Cie {formatPrice(shown.close)}</span>
        {change !== null && (
          <span className={change >= 0 ? "text-up" : "text-down"}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        )}
        {typeof shown.volume === "number" && (
          <span>
            Vol {formatVolume(shown.volume)}
            {baseSymbol ? ` ${baseSymbol}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
