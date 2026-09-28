import { FRESH, jsonCached } from "@/lib/httpCache";
import { getHacks } from "@/lib/sources/hacks";

export async function GET() {
  const result = await getHacks();
  return jsonCached(result, FRESH.hours6, { status: result.ok ? 200 : 502 });
}
