import { FRESH, jsonCached } from "@/lib/httpCache";
import { getDexTrades } from "@/lib/sources/dune";

export async function GET() {
  const result = await getDexTrades(8);
  return jsonCached(result, FRESH.hour, { status: result.ok ? 200 : 502 });
}
