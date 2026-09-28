import { FRESH, jsonCached } from "@/lib/httpCache";
import { getMovers } from "@/lib/sources/defillama";

export async function GET() {
  const result = await getMovers(5);
  return jsonCached(result, FRESH.minutes30, { status: result.ok ? 200 : 502 });
}
