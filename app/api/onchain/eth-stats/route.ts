import { NextResponse } from "next/server";
import { getEthStats } from "@/lib/sources/blockscout";

export async function GET() {
  const result = await getEthStats();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
