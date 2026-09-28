import { FRESH, jsonCached } from "@/lib/httpCache";
import { getTopProtocols } from "@/lib/sources/defillama";

export async function GET() {
  const result = await getTopProtocols(10);
  return jsonCached(result, FRESH.minutes30, { status: result.ok ? 200 : 502 });
}
