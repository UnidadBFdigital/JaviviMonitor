import { FRESH, jsonCached } from "@/lib/httpCache";
import { getSmartMoneyNetflow } from "@/lib/sources/nansen";

export async function GET() {
  const result = await getSmartMoneyNetflow(10);
  return jsonCached(result, FRESH.hour, { status: result.ok ? 200 : 502 });
}
