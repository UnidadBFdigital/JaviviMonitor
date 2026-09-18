"use client";

import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { useSource } from "@/lib/useSource";
import type { DexTrade } from "@/lib/sources/dune";

const COLUMNS: Column<DexTrade>[] = [
  {
    key: "time",
    header: "Hora (UTC)",
    value: (t) => t.time,
    required: true,
    render: (t) => <span className="tabular-nums">{t.time.slice(11, 19)}</span>,
  },
  { key: "chain", header: "Chain", value: (t) => t.chain },
  { key: "project", header: "DEX", value: (t) => t.project },
  { key: "pair", header: "Par", value: (t) => t.pair },
  {
    key: "bought",
    header: "Comprado",
    value: (t) => t.boughtAmount,
    numeric: true,
    render: (t) =>
      t.boughtAmount !== null
        ? `${t.boughtAmount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${t.boughtSymbol}`
        : "—",
  },
];

export function DexVolumeCard() {
  const result = useSource<DexTrade[]>("/api/defi/dex-volume", "Dune Analytics");

  return (
    <Card
      title="Últimos trades DEX"
      subtitle="Query pública de ejemplo de Dune — reemplazable por queries propias"
    >
      {result === null && <div className="h-56 animate-pulse rounded bg-ice/50" />}
      {result?.ok === false && <Unavailable source={result.source} />}
      {result?.ok && (
        <>
          <DataTable
            rows={result.data}
            columns={COLUMNS}
            exportName="trades-dex"
            initialSort={{ key: "time", dir: "desc" }}
          />
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </Card>
  );
}
