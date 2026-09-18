import { NextResponse } from "next/server";
import { getMovers } from "@/lib/sources/defillama";

export async function GET() {
  const result = await getMovers(5);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
