import { NextRequest, NextResponse } from "next/server";
import { FRESH, jsonCached } from "@/lib/httpCache";
import { getMarketPerformance } from "@/lib/sources/coingecko";

export async function GET(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get("days") ?? 90);
  const days = Number.isFinite(requested) ? requested : 90;
  const result = await getMarketPerformance(days);
  return jsonCached(result, FRESH.minutes30, { status: result.ok ? 200 : 502 });
}
