import { FRESH, jsonCached } from "@/lib/httpCache";
import { getEthStats } from "@/lib/sources/blockscout";

export async function GET() {
  const result = await getEthStats();
  return jsonCached(result, FRESH.minutes15, { status: result.ok ? 200 : 502 });
}
