import { FRESH, jsonCached } from "@/lib/httpCache";
import { getMarketAssets } from "@/lib/sources/coingecko";

export async function GET() {
  const result = await getMarketAssets();
  return jsonCached(result, FRESH.minutes5, { status: result.ok ? 200 : 502 });
}
