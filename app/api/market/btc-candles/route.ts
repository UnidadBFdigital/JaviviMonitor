import { NextResponse } from "next/server";
import { getDailyCandles } from "@/lib/sources/cryptocom";

export async function GET() {
  const result = await getDailyCandles("BTC_USDT", 90);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
