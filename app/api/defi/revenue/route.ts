import { FRESH, jsonCached } from "@/lib/httpCache";
import { getProtocolRevenue } from "@/lib/sources/defillama";

export async function GET() {
  const result = await getProtocolRevenue(10);
  return jsonCached(result, FRESH.minutes30, { status: result.ok ? 200 : 502 });
}
