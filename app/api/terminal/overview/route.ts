import { NextResponse } from "next/server";
import { FRESH, jsonCached, withCache } from "@/lib/httpCache";
import { getTickers, getDailyCandles } from "@/lib/sources/cryptocom";
import { getGlobalMarket } from "@/lib/sources/coingecko";
import { getTvlHistory } from "@/lib/sources/defillama";
import { getYahooSeries } from "@/lib/sources/yahoo";

// Top bar del Research Terminal: tickers + sparklines 30d + macro global.
// BNB no cotiza en Crypto.com — su card sale de Yahoo Finance.
const SPARK_INSTRUMENTS = ["BTC_USDT", "ETH_USDT", "SOL_USDT", "XRP_USDT"];

export async function GET() {
  const [tickers, global, tvl, bnbSeries, ...candles] = await Promise.all([
    getTickers(),
    getGlobalMarket(),
    getTvlHistory(30),
    getYahooSeries("BNB-USD", "3mo"),
    ...SPARK_INSTRUMENTS.map((i) => getDailyCandles(i, 30)),
  ]);

  let bnb: {
    ok: boolean;
    price?: number;
    change24hPct?: number | null;
    spark?: number[];
    fetchedAt?: string;
  } = { ok: false };
  if (bnbSeries.ok && bnbSeries.data.length >= 2) {
    const closes = bnbSeries.data.slice(-30).map((p) => p.close);
    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    bnb = {
      ok: true,
      price: last,
      change24hPct: prev > 0 ? ((last - prev) / prev) * 100 : null,
      spark: closes,
      fetchedAt: bnbSeries.fetchedAt,
    };
  }

  const sparklines: Record<string, number[]> = {};
  SPARK_INSTRUMENTS.forEach((inst, idx) => {
    const c = candles[idx];
    if (c.ok) sparklines[inst] = c.data.map((k) => k.close);
  });

  return withCache(NextResponse.json({
    tickers,
    bnb,
    global,
    tvl: tvl.ok
      ? {
          ok: true,
          source: tvl.source,
          fetchedAt: tvl.fetchedAt,
          stale: tvl.stale,
          data: {
            currentUsd: tvl.data[tvl.data.length - 1]?.tvlUsd ?? 0,
            spark: tvl.data.map((p) => p.tvlUsd),
          },
        }
      : tvl,
    sparklines,
  }), FRESH.minutes5);
}
