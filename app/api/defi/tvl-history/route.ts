import { FRESH, jsonCached } from "@/lib/httpCache";
import { getTvlHistory } from "@/lib/sources/defillama";

export async function GET() {
  const result = await getTvlHistory(365);
  return jsonCached(result, FRESH.minutes30, { status: result.ok ? 200 : 502 });
}
