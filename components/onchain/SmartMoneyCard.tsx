"use client";

import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatUsdCompact } from "@/lib/format";
import { useSource } from "@/lib/useSource";
import type { SmartMoneyFlow } from "@/lib/sources/nansen";

function flowCell(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const tone = value > 0 ? "text-up" : value < 0 ? "text-down" : "text-ink-muted";
  return (
    <span className={tone}>
      {sign}
      {formatUsdCompact(Math.abs(value))}
    </span>
  );
}

const COLUMNS: Column<SmartMoneyFlow>[] = [
  {
    key: "token",
    header: "Token",
    value: (f) => f.tokenSymbol,
    required: true,
    render: (f) => <span className="font-medium">{f.tokenSymbol}</span>,
  },
  { key: "chain", header: "Chain", value: (f) => f.chain },
  {
    key: "f24",
    header: "Netflow 24h",
    value: (f) => f.netFlow24hUsd,
    numeric: true,
    render: (f) => flowCell(f.netFlow24hUsd),
  },
  {
    key: "f7",
    header: "Netflow 7d",
    value: (f) => f.netFlow7dUsd,
    numeric: true,
    render: (f) => flowCell(f.netFlow7dUsd),
  },
  {
    key: "traders",
    header: "Traders",
    value: (f) => f.traderCount,
    numeric: true,
  },
];

export function SmartMoneyCard() {
  const result = useSource<SmartMoneyFlow[]>("/api/onchain/smart-money", "Nansen");

  return (
    <Card
      title="Flujos de smart money"
      subtitle="Netflow hacia tokens por wallets etiquetadas (fondos y traders destacados)"
    >
      {result === null && <div className="h-56 animate-pulse rounded bg-ice/50" />}
      {result?.ok === false && <Unavailable source={result.source} />}
      {result?.ok && (
        <>
          <DataTable
            rows={result.data}
            columns={COLUMNS}
            exportName="smart-money-netflow"
            initialSort={{ key: "f24", dir: "desc" }}
          />
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </Card>
  );
}
