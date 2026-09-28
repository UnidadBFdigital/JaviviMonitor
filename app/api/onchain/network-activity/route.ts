import { FRESH, jsonCached } from "@/lib/httpCache";
import { getNetworkActivity } from "@/lib/sources/coinmetrics";

export async function GET() {
  const result = await getNetworkActivity(30);
  return jsonCached(result, FRESH.hour, { status: result.ok ? 200 : 502 });
}
