"use client";

import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatUsdCompact, formatPct } from "@/lib/format";
import { categoryColor } from "@/lib/categoryColor";
import { useSource } from "@/lib/useSource";
import type { ProtocolTvl } from "@/lib/sources/defillama";

function changeCell(value: number | null) {
  const tone =
    value === null ? "text-ink-muted" : value > 0 ? "text-up" : value < 0 ? "text-down" : "text-ink-secondary";
  return <span className={tone}>{formatPct(value)}</span>;
}

const COLUMNS: Column<ProtocolTvl>[] = [
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
  { key: "chain", header: "Chain", value: (p) => p.chain },
  {
    key: "tvl",
    header: "TVL",
    value: (p) => p.tvlUsd,
    numeric: true,
    render: (p) => formatUsdCompact(p.tvlUsd),
  },
  {
    key: "d1",
    header: "24h",
    value: (p) => p.change1dPct,
    numeric: true,
    render: (p) => changeCell(p.change1dPct),
  },
  {
    key: "d7",
    header: "7d",
    value: (p) => p.change7dPct,
    numeric: true,
    render: (p) => changeCell(p.change7dPct),
  },
];

export function TopProtocolsCard() {
  const result = useSource<ProtocolTvl[]>("/api/defi/protocols", "DeFiLlama");

  return (
    <Card title="TVL por protocolo" subtitle="Top 10 por valor total bloqueado">
      {result === null && <div className="h-64 animate-pulse rounded bg-ice/50" />}
      {result?.ok === false && <Unavailable source={result.source} />}
      {result?.ok && (
        <>
          <DataTable
            rows={result.data}
            columns={COLUMNS}
            exportName="tvl-por-protocolo"
            initialSort={{ key: "tvl", dir: "desc" }}
            rowHistory={(p) => ({ kind: "protocol", id: p.slug, label: p.name })}
          />
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </Card>
  );
}
