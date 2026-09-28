import { NextRequest, NextResponse } from "next/server";
import { FRESH, jsonCached } from "@/lib/httpCache";
import {
  getProtocolIncomeStatement,
  getProtocolRevenue,
} from "@/lib/sources/defillama";

export async function GET(request: NextRequest) {
  const protocol = request.nextUrl.searchParams.get("protocol") ?? "aave";
  const [ranking, statement] = await Promise.all([
    getProtocolRevenue(20),
    getProtocolIncomeStatement(protocol),
  ]);
  return jsonCached({ ranking, statement }, FRESH.minutes30);
}
