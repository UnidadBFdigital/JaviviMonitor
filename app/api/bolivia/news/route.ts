import { FRESH, jsonCached } from "@/lib/httpCache";
import { getBoliviaNews } from "@/lib/sources/bolivianews";

export async function GET() {
  const result = await getBoliviaNews(15);
  return jsonCached(result, FRESH.minutes30, { status: result.ok ? 200 : 502 });
}
