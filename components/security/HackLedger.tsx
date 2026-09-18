"use client";

import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatUsdCompact } from "@/lib/format";
import type { HackEvent } from "@/lib/sources/hacks";

// Registro completo, una fila por incidente. Es la capa auditable: todo lo
// que resumen los KPI y los rankings se puede rastrear hasta acá y exportar.

const COLUMNS: Column<HackEvent>[] = [
  {
    key: "date",
    header: "Fecha",
    value: (e) => e.date,
    required: true,
    render: (e) => <span className="whitespace-nowrap tabular-nums">{e.date}</span>,
  },
  {
    key: "name",
    header: "Objetivo",
    value: (e) => e.name,
    render: (e) => (
      <span className="font-medium">
        {e.name}
        {e.bridgeHack && (
          <span className="ml-1.5 rounded bg-warn/15 px-1 py-px text-[9px] uppercase tracking-wide text-warn">
            bridge
          </span>
        )}
      </span>
    ),
  },
  {
    key: "amount",
    header: "Robado",
    value: (e) => e.amountUsd,
    numeric: true,
    // Sin monto confirmado no es cero: la celda lo dice, no lo inventa.
    render: (e) =>
      e.amountUsd === null ? (
        <span className="text-ink-muted">n/d</span>
      ) : (
        <span className="tabular-nums">{formatUsdCompact(e.amountUsd)}</span>
      ),
  },
  {
    key: "returned",
    header: "Devuelto",
    value: (e) => e.returnedUsd,
    numeric: true,
    render: (e) =>
      e.returnedUsd === null || e.returnedUsd === 0 ? (
        <span className="text-ink-muted">—</span>
      ) : (
        <span className="tabular-nums text-up">{formatUsdCompact(e.returnedUsd)}</span>
      ),
  },
  {
    key: "chains",
    header: "Redes",
    value: (e) => e.chains.join(", "),
    // Hay ~130 redes en el registro: colorearlas sería ruido, no información.
    render: (e) => (
      <span className="whitespace-nowrap">
        {e.chains.map((chain) => (
          <span
            key={chain}
            className="mr-1 rounded border border-line bg-ice/50 px-1.5 py-0.5 text-[10px] text-ink-secondary"
          >
            {chain}
          </span>
        ))}
      </span>
    ),
  },
  {
    key: "classification",
    header: "Vector",
    value: (e) => e.classification,
    render: (e) => <span className="whitespace-nowrap">{e.classification}</span>,
  },
  {
    key: "technique",
    header: "Técnica",
    value: (e) => e.technique,
    render: (e) => <span className="whitespace-nowrap">{e.technique}</span>,
  },
  {
    key: "targetType",
    header: "Tipo",
    value: (e) => e.targetType,
    render: (e) => <span className="whitespace-nowrap">{e.targetType}</span>,
  },
  {
    key: "language",
    header: "Lenguaje",
    value: (e) => e.language,
    render: (e) =>
      e.language ? (
        <span className="whitespace-nowrap">{e.language}</span>
      ) : (
        <span className="text-ink-muted">—</span>
      ),
  },
];

export function HackLedger({ events }: { events: HackEvent[] }) {
  return (
    <DataTable
      rows={events}
      columns={COLUMNS}
      exportName="incidentes-seguridad"
      initialSort={{ key: "date", dir: "desc" }}
      emptyLabel="Ningún incidente con estos filtros"
      maxHeight="max-h-[32rem]"
    />
  );
}
