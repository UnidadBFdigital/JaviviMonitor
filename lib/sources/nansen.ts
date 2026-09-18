// Módulo Nansen — requiere NANSEN_API_KEY (plan de pago).
// Netflow de "smart money": hacia qué tokens están entrando/saliendo
// las wallets etiquetadas como fondos y traders destacados.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

const BASE = "https://api.nansen.ai";
export const SOURCE = "Nansen";

export type SmartMoneyFlow = {
  tokenSymbol: string;
  chain: string;
  netFlow24hUsd: number;
  netFlow7dUsd: number;
  traderCount: number | null;
};

type RawFlow = {
  token_symbol?: string;
  chain?: string;
  net_flow_24h_usd?: number;
  net_flow_7d_usd?: number;
  trader_count?: number;
};

export async function getSmartMoneyNetflow(
  limit = 10
): Promise<SourceResult<SmartMoneyFlow[]>> {
  const apiKey = process.env.NANSEN_API_KEY;
  // una key real tiene bastante más de 10 caracteres
  if (!apiKey || apiKey.length < 10) {
    return { ok: false, source: SOURCE, error: "NANSEN_API_KEY no configurada en .env.local" };
  }
  try {
    const { data, fetchedAt, stale } = await cached(
      `nansen:smart-money-netflow:${limit}`,
      async () => {
        const res = await fetch(`${BASE}/api/v1/smart-money/netflow`, {
          method: "POST",
          cache: "no-store",
          headers: {
            apikey: apiKey,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            chains: ["ethereum", "solana"],
            order_by: [{ field: "net_flow_24h_usd", direction: "DESC" }],
            pagination: { page: 1, per_page: limit },
          }),
        });
        if (!res.ok) throw new Error(`${SOURCE} netflow → HTTP ${res.status}`);
        const json = (await res.json()) as { data?: RawFlow[] } | RawFlow[];
        const rows = Array.isArray(json) ? json : (json.data ?? []);
        return rows.map((r) => ({
          tokenSymbol: r.token_symbol ?? "—",
          chain: r.chain ?? "—",
          netFlow24hUsd: r.net_flow_24h_usd ?? 0,
          netFlow7dUsd: r.net_flow_7d_usd ?? 0,
          traderCount: r.trader_count ?? null,
        }));
      },
      60 * 60 * 1000 // 1 h — plan de pago, cuidar la cuota
    );
    return { ok: true, data, source: SOURCE, fetchedAt, stale };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
