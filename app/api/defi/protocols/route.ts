import { NextResponse } from "next/server";
import { getTopProtocols } from "@/lib/sources/defillama";

export async function GET() {
  const result = await getTopProtocols(10);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
