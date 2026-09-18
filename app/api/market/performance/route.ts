import { NextRequest, NextResponse } from "next/server";
import { getMarketPerformance } from "@/lib/sources/coingecko";

export async function GET(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get("days") ?? 90);
  const days = Number.isFinite(requested) ? requested : 90;
  const result = await getMarketPerformance(days);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
