import { FRESH, jsonCached } from "@/lib/httpCache";
import { getTickers } from "@/lib/sources/cryptocom";

export async function GET() {
  const result = await getTickers();
  return jsonCached(result, FRESH.minutes5, { status: result.ok ? 200 : 502 });
}
