import { NextResponse } from "next/server";
import { getHeadlines } from "@/lib/sources/news";

export async function GET() {
  const result = await getHeadlines(12);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
