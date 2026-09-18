import { NextResponse } from "next/server";
import { getInstitutionalNews, getRegulatoryNews } from "@/lib/sources/news";

export async function GET() {
  const [institutional, regulatory] = await Promise.all([
    getInstitutionalNews(20),
    getRegulatoryNews(8),
  ]);
  return NextResponse.json({ institutional, regulatory });
}
