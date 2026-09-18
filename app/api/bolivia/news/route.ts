import { NextResponse } from "next/server";
import { getBoliviaNews } from "@/lib/sources/bolivianews";

export async function GET() {
  const result = await getBoliviaNews(15);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
