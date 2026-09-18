"use client";

import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { useSource } from "@/lib/useSource";
import type { EthStats } from "@/lib/sources/blockscout";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function EthStatsCard() {
  const result = useSource<EthStats>("/api/onchain/eth-stats", "Blockscout (Ethereum)");

  return (
    <Card title="Red Ethereum" subtitle="Actividad on-chain en vivo (mainnet)">
      {result === null && <div className="h-40 animate-pulse rounded bg-ice/40" />}
      {result?.ok === false && <Unavailable source={result.source} />}
      {result?.ok && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Transacciones hoy"
              value={result.data.transactionsToday.toLocaleString("en-US")}
            />
            <Stat
              label="Gas promedio"
              value={
                result.data.gasPriceGwei
                  ? `${result.data.gasPriceGwei.average} gwei`
                  : "—"
              }
            />
            <Stat
              label="Precio ETH"
              value={
                result.data.ethPriceUsd
                  ? `$${result.data.ethPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                  : "—"
              }
            />
            <Stat
              label="Tiempo de bloque"
              value={`${(result.data.averageBlockTimeMs / 1000).toFixed(1)} s`}
            />
          </div>
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </Card>
  );
}
