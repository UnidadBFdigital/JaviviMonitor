import { NextResponse } from "next/server";
import { getHacks } from "@/lib/sources/hacks";

export async function GET() {
  const result = await getHacks();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
