import { NextResponse } from "next/server";
import { getTickers } from "@/lib/sources/cryptocom";

export async function GET() {
  const result = await getTickers();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
