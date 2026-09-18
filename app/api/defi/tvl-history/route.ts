import { NextResponse } from "next/server";
import { getTvlHistory } from "@/lib/sources/defillama";

export async function GET() {
  const result = await getTvlHistory(365);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
