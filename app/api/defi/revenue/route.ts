import { NextResponse } from "next/server";
import { getProtocolRevenue } from "@/lib/sources/defillama";

export async function GET() {
  const result = await getProtocolRevenue(10);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
