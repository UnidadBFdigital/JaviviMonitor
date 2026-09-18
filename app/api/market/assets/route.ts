import { NextResponse } from "next/server";
import { getMarketAssets } from "@/lib/sources/coingecko";

export async function GET() {
  const result = await getMarketAssets();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
