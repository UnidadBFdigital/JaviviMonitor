// Módulo Blockscout — gratis, sin API key. Datos on-chain de Ethereum mainnet.

import { cached } from "@/lib/cache";
import type { SourceResult } from "./types";

const BASE = "https://eth.blockscout.com/api/v2";
export const SOURCE = "Blockscout (Ethereum)";

export type EthStats = {
  totalTransactions: number;
  transactionsToday: number;
  totalAddresses: number;
  averageBlockTimeMs: number;
  gasPriceGwei: { slow: number; average: number; fast: number } | null;
  ethPriceUsd: number | null;
};

type RawStats = {
  total_transactions: string;
  transactions_today: string;
  total_addresses: string;
  average_block_time: number;
  gas_prices: { slow: number; average: number; fast: number } | null;
  coin_price: string | null;
};

export async function getEthStats(): Promise<SourceResult<EthStats>> {
  try {
    const { data, fetchedAt, stale } = await cached(
      "blockscout:eth-stats",
      async () => {
        const res = await fetch(`${BASE}/stats`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`${SOURCE} /stats → HTTP ${res.status}`);
        return res.json() as Promise<RawStats>;
      },
      15 * 60 * 1000 // 15 min — datos de red cambian rápido
    );
    return {
      ok: true,
      data: {
        totalTransactions: Number(data.total_transactions),
        transactionsToday: Number(data.transactions_today),
        totalAddresses: Number(data.total_addresses),
        averageBlockTimeMs: data.average_block_time,
        gasPriceGwei: data.gas_prices,
        ethPriceUsd: data.coin_price ? Number(data.coin_price) : null,
      },
      source: SOURCE,
      fetchedAt,
      stale,
    };
  } catch (err) {
    return { ok: false, source: SOURCE, error: String(err) };
  }
}
