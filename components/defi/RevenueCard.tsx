"use client";

import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatUsdCompact } from "@/lib/format";
import { categoryColor } from "@/lib/categoryColor";
import { useSource } from "@/lib/useSource";
import type { ProtocolRevenue } from "@/lib/sources/defillama";

const COLUMNS: Column<ProtocolRevenue>[] = [
  {
    key: "name",
    header: "Protocolo",
    value: (p) => p.name,
    required: true,
    render: (p) => <span className="font-medium">{p.name}</span>,
  },
  {
    key: "category",
    header: "Categoría",
    value: (p) => p.category,
    render: (p) => (
      <span
        className="rounded px-1.5 py-0.5 text-[10px]"
        style={{ background: `${categoryColor(p.category)}26`, color: categoryColor(p.category) }}
      >
        {p.category}
      </span>
    ),
  },
  {
    key: "r24",
    header: "24h",
    value: (p) => p.revenue24hUsd,
    numeric: true,
    render: (p) => formatUsdCompact(p.revenue24hUsd),
  },
  {
    key: "r7",
    header: "7d",
    value: (p) => p.revenue7dUsd,
    numeric: true,
    render: (p) => (p.revenue7dUsd !== null ? formatUsdCompact(p.revenue7dUsd) : "—"),
  },
  {
    key: "r30",
    header: "30d",
    value: (p) => p.revenue30dUsd,
    numeric: true,
    render: (p) => (p.revenue30dUsd !== null ? formatUsdCompact(p.revenue30dUsd) : "—"),
  },
];

export function RevenueCard() {
  const result = useSource<ProtocolRevenue[]>("/api/defi/revenue", "DeFiLlama");

  return (
    <Card title="Revenue por protocolo" subtitle="Top 10 por revenue diario">
      {result === null && <div className="h-64 animate-pulse rounded bg-ice/50" />}
      {result?.ok === false && <Unavailable source={result.source} />}
      {result?.ok && (
        <>
          <DataTable
            rows={result.data}
            columns={COLUMNS}
            exportName="revenue-por-protocolo"
            initialSort={{ key: "r24", dir: "desc" }}
            rowHistory={(p) => (p.slug ? { kind: "protocol", id: p.slug, label: p.name } : null)}
          />
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </Card>
  );
}
