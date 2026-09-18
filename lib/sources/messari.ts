// Módulo Messari — requiere MESSARI_API_KEY (tier gratuito, rate-limited).
// El tier free da acceso a /metrics/v2 (precio, volumen, marketcap);
// research reports y news devuelven 403 en este plan.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

const BASE = "https://api.messari.io";
export const SOURCE = "Messari";

// El tier free solo expone BTC y ETH; otros slugs se ignoran silenciosamente.
const SLUGS = ["bitcoin", "ethereum"];

export type AssetOverview = {
  name: string;
  symbol: string;
  priceUsd: number;
  change24hPct: number | null;
  volume24hUsd: number;
  marketcapUsd: number;
  dominancePct: number | null;
};

type RawAsset = {
  name: string;
  symbol: string;
  marketData?: {
    priceUsd?: number;
    volume24Hour?: number;
    ohlcv24HourUsd?: { open?: number; close?: number };
    marketcap?: { circulatingUsd?: number; dominance?: number };
  };
};

export async function getAssetOverview(): Promise<SourceResult<AssetOverview[]>> {
  const apiKey = process.env.MESSARI_API_KEY;
  if (!apiKey) {
    return { ok: false, source: SOURCE, error: "MESSARI_API_KEY no configurada en .env.local" };
  }
  try {
    const { data, fetchedAt, stale } = await cached(
      "messari:asset-overview",
      async () => {
        const res = await fetch(
          `${BASE}/metrics/v2/assets/details?slugs=${SLUGS.join(",")}`,
          {
            cache: "no-store",
            headers: { "X-Messari-API-Key": apiKey, accept: "application/json" },
          }
        );
        if (!res.ok) throw new Error(`${SOURCE} assets/details → HTTP ${res.status}`);
        const json = (await res.json()) as { data?: RawAsset[] };
        return (json.data ?? []).flatMap((a) => {
          const md = a.marketData;
          if (!md?.priceUsd) return [];
          const open = md.ohlcv24HourUsd?.open;
          const close = md.ohlcv24HourUsd?.close;
          return [
            {
              name: a.name,
              symbol: a.symbol,
              priceUsd: md.priceUsd,
              change24hPct:
                open && close ? ((close - open) / open) * 100 : null,
              volume24hUsd: md.volume24Hour ?? 0,
              marketcapUsd: md.marketcap?.circulatingUsd ?? 0,
              dominancePct: md.marketcap?.dominance ?? null,
            },
          ];
        });
      },
      15 * 60 * 1000 // 15 min — el tier free es rate-limited, no abusar
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
