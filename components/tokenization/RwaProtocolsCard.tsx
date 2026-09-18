"use client";

import { DataTable, type Column } from "@/components/tables/DataTable";
import { SourceBadge } from "@/components/SourceBadge";
import { formatUsdCompact, formatPct } from "@/lib/format";
import type { ProtocolTvl } from "@/lib/sources/defillama";
import { useRwa } from "./useRwa";

const columns: Column<ProtocolTvl>[] = [
  { key: "name", header: "Protocolo", value: (r) => r.name, required: true },
  { key: "category", header: "Categoría DeFiLlama", value: (r) => r.category },
  { key: "chain", header: "Red", value: (r) => r.chain },
  {
    key: "tvl",
    header: "TVL del protocolo",
    numeric: true,
    value: (r) => r.tvlUsd,
    render: (r) => formatUsdCompact(r.tvlUsd),
  },
  {
    key: "ch7",
    header: "7d",
    numeric: true,
    value: (r) => r.change7dPct,
    render: (r) => (
      <span
        className={
          r.change7dPct === null ? "text-ink-muted" : r.change7dPct >= 0 ? "text-up" : "text-down"
        }
      >
        {formatPct(r.change7dPct)}
      </span>
    ),
  },
];

export function RwaProtocolsCard() {
  const { data, error } = useRwa();

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Protocolos DeFi clasificados como RWA</h3>
      <p className="mb-3 text-xs text-ink-secondary">
        Los 40 mayores por TVL en las categorías RWA y RWA Lending. No es una tabla de emisores ni
        de capitalización de activos. Ordenable y exportable a CSV.
      </p>

      {error && <p className="py-6 text-sm text-ink-muted">No disponible (error de red).</p>}
      {!data && !error && <div className="h-72 animate-pulse rounded bg-ice/50" />}

      {data && !data.source.ok && (
        <p className="py-6 text-sm text-ink-muted">Dato no disponible — DeFiLlama sin respuesta.</p>
      )}

      {data?.source.ok && (
        <>
          <DataTable
            rows={data.protocols}
            columns={columns}
            exportName="rwa-protocolos"
            initialSort={{ key: "tvl", dir: "desc" }}
            rowHistory={(r) => ({ kind: "protocol", id: r.slug, label: r.name })}
          />
          <SourceBadge
            source={data.source.source}
            fetchedAt={data.source.fetchedAt}
            stale={data.source.stale}
          />
        </>
      )}
    </section>
  );
}
