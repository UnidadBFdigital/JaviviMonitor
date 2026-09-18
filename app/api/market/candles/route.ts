import { NextRequest, NextResponse } from "next/server";
import { CANDLE_MARKETS, getDailyCandles } from "@/lib/sources/cryptocom";

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("asset") ?? "BTC").toUpperCase();
  const market = CANDLE_MARKETS.find((item) => item.symbol === symbol) ?? CANDLE_MARKETS[0];
  const requestedDays = Number(request.nextUrl.searchParams.get("days") ?? 90);
  const days = Number.isFinite(requestedDays) ? requestedDays : 90;
  const result = await getDailyCandles(market.instrument, days);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
