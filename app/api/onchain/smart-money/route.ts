import { NextResponse } from "next/server";
import { getSmartMoneyNetflow } from "@/lib/sources/nansen";

export async function GET() {
  const result = await getSmartMoneyNetflow(10);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
