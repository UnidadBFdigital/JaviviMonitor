import { FRESH, jsonCached } from "@/lib/httpCache";
import { getHeadlines } from "@/lib/sources/news";

export async function GET() {
  const result = await getHeadlines(12);
  return jsonCached(result, FRESH.minutes30, { status: result.ok ? 200 : 502 });
}
