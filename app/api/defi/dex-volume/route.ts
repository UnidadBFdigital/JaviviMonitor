import { NextResponse } from "next/server";
import { getDexTrades } from "@/lib/sources/dune";

export async function GET() {
  const result = await getDexTrades(8);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
