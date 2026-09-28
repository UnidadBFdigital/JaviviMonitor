import { FRESH, jsonCached } from "@/lib/httpCache";
import { getDailyCandles } from "@/lib/sources/cryptocom";

export async function GET() {
  const result = await getDailyCandles("BTC_USDT", 90);
  return jsonCached(result, FRESH.hour, { status: result.ok ? 200 : 502 });
}
