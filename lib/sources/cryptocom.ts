// Módulo Crypto.com Exchange — API pública, sin key para market data.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

const BASE = "https://api.crypto.com/exchange/v1";
export const SOURCE = "Crypto.com Exchange";

// Crypto.com no lista BNB (instrument_name inválido): ese par se trae de
// Yahoo Finance en lib/sources/yahoo.ts.
const INSTRUMENTS = ["BTC_USDT", "ETH_USDT", "SOL_USDT", "XRP_USDT"];
export const CANDLE_MARKETS = [
  { symbol: "BTC", instrument: "BTC_USDT", name: "Bitcoin" },
  { symbol: "ETH", instrument: "ETH_USDT", name: "Ethereum" },
  { symbol: "SOL", instrument: "SOL_USDT", name: "Solana" },
  { symbol: "XRP", instrument: "XRP_USDT", name: "XRP" },
] as const;

export type Ticker = {
  instrument: string;
  lastPrice: number;
  change24hPct: number | null;
  high24h: number;
  low24h: number;
  volume24hUsd: number;
};

type RawTicker = {
  i: string; // instrument
  a: string; // last trade price
  c: string; // 24h change (decimal, ej. 0.0123 = +1.23%)
  h: string;
  l: string;
  vv: string; // volumen 24h en USD
};

export type Candle = {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  /** volumen del día en la moneda base (BTC, ETH…), tal como lo publica el exchange */
  volume: number | null;
};

type RawCandle = { t: number; o: string; h: string; l: string; c: string; v?: string };

export async function getDailyCandles(
  instrument = "BTC_USDT",
  days = 90
): Promise<SourceResult<Candle[]>> {
  const safeInstrument = INSTRUMENTS.includes(instrument) ? instrument : "BTC_USDT";
  const safeDays = Math.max(7, Math.min(Math.round(days), 300));
  try {
    const { data, fetchedAt, stale } = await cached(
      `cryptocom:candles:${safeInstrument}:${safeDays}`,
      async () => {
        const res = await fetch(
          `${BASE}/public/get-candlestick?instrument_name=${safeInstrument}&timeframe=1D&count=${safeDays}`,
          { cache: "no-store", headers: { accept: "application/json" } }
        );
        if (!res.ok) throw new Error(`${SOURCE} get-candlestick → HTTP ${res.status}`);
        const json = (await res.json()) as { result?: { data?: RawCandle[] } };
        return (json.result?.data ?? [])
          .map((k) => ({
            date: new Date(k.t).toISOString().slice(0, 10),
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: k.v !== undefined && Number.isFinite(Number(k.v)) ? Number(k.v) : null,
          }))
          .filter(
            (candle) =>
              Number.isFinite(candle.open) &&
              Number.isFinite(candle.high) &&
              Number.isFinite(candle.low) &&
              Number.isFinite(candle.close) &&
              candle.low > 0
          )
          .sort((a, b) => a.date.localeCompare(b.date));
      },
      60 * 60 * 1000 // 1 h — velas diarias
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}

export async function getTickers(): Promise<SourceResult<Ticker[]>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "cryptocom:tickers",
      async () => {
        const res = await fetch(`${BASE}/public/get-tickers`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`${SOURCE} get-tickers → HTTP ${res.status}`);
        const json = (await res.json()) as { result?: { data?: RawTicker[] } };
        const all = json.result?.data ?? [];
        // filtramos acá para cachear solo lo que usamos, no ~800 instrumentos
        return all.filter((t) => INSTRUMENTS.includes(t.i));
      },
      5 * 60 * 1000 // 5 min — son precios
    );
    const tickers = INSTRUMENTS.flatMap((name) => {
      const t = data.find((x) => x.i === name);
      if (!t) return [];
      return [
        {
          instrument: name,
          lastPrice: Number(t.a),
          change24hPct: t.c !== null && t.c !== undefined ? Number(t.c) * 100 : null,
          high24h: Number(t.h),
          low24h: Number(t.l),
          volume24hUsd: Number(t.vv),
        },
      ];
    });
    return { ok: true, data: tickers, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
