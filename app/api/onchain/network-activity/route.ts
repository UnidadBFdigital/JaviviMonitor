import { NextResponse } from "next/server";
import { getNetworkActivity } from "@/lib/sources/coinmetrics";

export async function GET() {
  const result = await getNetworkActivity(30);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
