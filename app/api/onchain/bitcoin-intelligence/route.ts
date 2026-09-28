import { FRESH, jsonCached } from "@/lib/httpCache";
import { getBitcoinDerivativesData } from "@/lib/sources/binanceFutures";
import { getBitcoinOnchainData } from "@/lib/sources/coinmetrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const [onchain, derivatives] = await Promise.all([
    getBitcoinOnchainData(365),
    getBitcoinDerivativesData(),
  ]);

  const hasData = onchain.ok || derivatives.ok;
  return jsonCached({
      onchain,
      derivatives,
      generatedAt: new Date().toISOString(),
    }, FRESH.minutes5,
    { status: hasData ? 200 : 502 });
}
