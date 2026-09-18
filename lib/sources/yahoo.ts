// Series diarias de Yahoo Finance (endpoint público de charts, sin key).
// Cubre macro tradicional (S&P 500, oro, DXY, UST 10Y) y pares que
// Crypto.com no lista (BNB). Stooq quedó descartado: bloquea clientes
// server-side con un challenge JavaScript.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

export const SOURCE = "Yahoo Finance";

export const MACRO_SYMBOLS: { id: string; yahoo: string; label: string }[] = [
  { id: "spx", yahoo: "^GSPC", label: "S&P 500" },
  { id: "gold", yahoo: "GC=F", label: "Oro" },
  { id: "dxy", yahoo: "DX-Y.NYB", label: "DXY" },
  { id: "us10y", yahoo: "^TNX", label: "UST 10Y" },
];

export type DailySeries = { date: string; close: number }[];

type RawChart = {
  chart: {
    error: unknown;
    result?: {
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[] }[] };
    }[];
  };
};

export async function getYahooSeries(
  symbol: string,
  range = "6mo"
): Promise<SourceResult<DailySeries>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      `yahoo:${symbol}:${range}`,
      async () => {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
          {
            cache: "no-store",
            headers: {
              accept: "application/json",
              "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            },
          }
        );
        if (!res.ok) throw new Error(`${SOURCE} ${symbol} → HTTP ${res.status}`);
        const json = (await res.json()) as RawChart;
        const result = json.chart.result?.[0];
        if (json.chart.error || !result?.timestamp) {
          throw new Error(`${SOURCE} ${symbol} → sin datos`);
        }
        const closes = result.indicators.quote[0].close;
        return result.timestamp.flatMap((t, i) => {
          const c = closes[i];
          if (c === null || c === undefined) return [];
          return [{ date: new Date(t * 1000).toISOString().slice(0, 10), close: c }];
        });
      },
      6 * 60 * 60 * 1000 // 6 h — series diarias
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

// --- Cotizaciones puntuales (ETF y equities cripto) ---

export type Quote = {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  change1dPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  /** acciones/participaciones negociadas en la última sesión */
  volume: number | null;
  /** volumen × precio: proxy de actividad en USD, no es flujo neto del fondo */
  turnoverUsd: number | null;
  spark: number[];
};

type RawQuoteChart = {
  chart: {
    error: unknown;
    result?: {
      meta?: { currency?: string; longName?: string; shortName?: string };
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[]; volume?: (number | null)[] }[] };
    }[];
  };
};

/** Variación entre el último cierre y el de `back` sesiones atrás. */
function changePct(closes: number[], back: number): number | null {
  if (closes.length <= back) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - back];
  if (!prev) return null;
  return ((last - prev) / prev) * 100;
}

type QuoteResult = { quote: Quote; fetchedAt: string; stale: boolean };

async function getQuote(symbol: string): Promise<QuoteResult | null> {
  const { data, fetchedAt, stale } = await cached(
    `yahoo:quote:${symbol}`,
    async () => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`,
        {
          cache: "no-store",
          headers: {
            accept: "application/json",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        }
      );
      if (!res.ok) throw new Error(`${SOURCE} ${symbol} → HTTP ${res.status}`);
      const json = (await res.json()) as RawQuoteChart;
      const result = json.chart.result?.[0];
      if (json.chart.error || !result?.timestamp) throw new Error(`${SOURCE} ${symbol} → sin datos`);
      return result;
    },
    60 * 60 * 1000 // 1 h
  );

  const q = data.indicators.quote[0];
  const closes = q.close.filter((c): c is number => c !== null && c !== undefined);
  if (closes.length === 0) return null;

  const volumes = (q.volume ?? []).filter((v): v is number => v !== null && v !== undefined);
  const price = closes[closes.length - 1];
  const volume = volumes.length > 0 ? volumes[volumes.length - 1] : null;

  const quote: Quote = {
    symbol,
    name: data.meta?.longName ?? data.meta?.shortName ?? symbol,
    currency: data.meta?.currency ?? "USD",
    price,
    change1dPct: changePct(closes, 1),
    change7dPct: changePct(closes, 5), // 5 sesiones ≈ 1 semana bursátil
    change30dPct: changePct(closes, 21), // 21 sesiones ≈ 1 mes bursátil
    volume,
    turnoverUsd: volume !== null ? volume * price : null,
    spark: closes.slice(-30),
  };

  return { quote, fetchedAt, stale };
}

/** Cotizaciones de varios símbolos; los que fallan se omiten en vez de tumbar la card. */
export async function getQuotes(symbols: string[]): Promise<SourceResult<Quote[]>> {
  const settled = await Promise.allSettled(symbols.map(getQuote));
  const results = settled.flatMap((r) =>
    r.status === "fulfilled" && r.value !== null ? [r.value] : []
  );
  if (results.length === 0) {
    return { ok: false, source: SOURCE, error: "ningún símbolo respondió" };
  }
  // el timestamp que se muestra es el del dato más viejo del lote
  const fetchedAt = results.map((r) => r.fetchedAt).sort()[0];
  return {
    ok: true,
    data: results.map((r) => r.quote),
    source: SOURCE,
    fetchedAt,
    stale: results.some((r) => r.stale),
  };
}
