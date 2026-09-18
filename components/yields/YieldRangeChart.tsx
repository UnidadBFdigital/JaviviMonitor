"use client";

import { OPERATION_BY_ID, type OperationId, type OperationSummary } from "@/lib/yields";
import { OPERATION_COLOR, formatApy } from "./atoms";

// ¿Cuánto rinde cada tipo de operación? Una fila por operación: la barra va
// del percentil 25 al 75 —la mitad central de los pools— y el punto marca la
// mediana. Responde "qué es normal" antes de mirar pools sueltos, que es donde
// un APY de tres cifras engaña.

export function YieldRangeChart({
  operations,
  selected,
  onSelect,
}: {
  operations: OperationSummary[];
  selected: OperationId | "all";
  onSelect: (id: OperationId | "all") => void;
}) {
  const rows = operations
    .filter((o): o is OperationSummary & { p25: number; median: number; p75: number } => o.count >= 3 && o.median !== null)
    .sort((a, b) => b.median - a.median);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-xs text-ink-muted">No hay suficientes pools con estos filtros para mostrar rangos.</p>;
  }

  // escala hasta el mayor percentil 75, con aire; un APY extremo no la estira
  const max = Math.max(...rows.map((r) => r.p75)) * 1.15 || 1;
  const step = max > 40 ? 20 : max > 16 ? 5 : max > 6 ? 2 : 1;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const x = (value: number) => `${Math.min((Math.max(value, 0) / max) * 100, 100)}%`;

  return (
    <div>
      <div className="relative ml-[7.5rem] mr-24 h-4 text-[9px] text-ink-muted" aria-hidden>
        {ticks.map((tick) => (
          <span key={tick} className="absolute -translate-x-1/2 tabular-nums" style={{ left: x(tick) }}>
            {tick}%
          </span>
        ))}
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const operation = OPERATION_BY_ID.get(row.id)!;
          const color = OPERATION_COLOR[row.id];
          const active = selected === row.id;
          const dimmed = selected !== "all" && !active;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelect(active ? "all" : row.id)}
                aria-pressed={active}
                title={`${operation.label}: la mitad de los ${row.count} pools rinde entre ${formatApy(row.p25)} y ${formatApy(row.p75)}; mediana ${formatApy(row.median)}.`}
                className={`flex w-full items-center gap-2 rounded px-1 py-1 text-left transition-opacity hover:bg-ice/30 ${dimmed ? "opacity-40" : ""}`}
              >
                <span className="w-[7rem] shrink-0 truncate text-[11px] text-ink-secondary">{operation.label}</span>
                <span className="relative h-5 min-w-0 flex-1">
                  <span className="absolute inset-y-0 left-0 right-0 my-auto h-px bg-line" aria-hidden />
                  {ticks.map((tick) => (
                    <span key={tick} className="absolute inset-y-0 w-px bg-line/40" style={{ left: x(tick) }} aria-hidden />
                  ))}
                  <span
                    className="bf-grow-x absolute top-1/2 h-2.5 -translate-y-1/2 rounded"
                    style={{ left: x(row.p25), width: `calc(${x(row.p75)} - ${x(row.p25)})`, minWidth: 4, background: color, opacity: 0.75 }}
                    aria-hidden
                  />
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
                    style={{ left: x(row.median), background: color }}
                    aria-hidden
                  />
                </span>
                <span className="w-[5.5rem] shrink-0 text-right text-[11px] tabular-nums">
                  <span className="font-semibold text-ink">{formatApy(row.median)}</span>
                  <span className="block text-[9px] text-ink-muted">
                    {formatApy(row.p25)}–{formatApy(row.p75)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-5 rounded bg-ink-muted/60" aria-hidden /> la mitad central de los pools
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-card bg-ink-secondary" aria-hidden /> mediana
        </span>
        <span>Tocá una fila para filtrar.</span>
      </p>
      <table className="sr-only">
        <caption>Rango de APY por tipo de operación</caption>
        <thead>
          <tr>
            <th>Operación</th>
            <th>Percentil 25</th>
            <th>Mediana</th>
            <th>Percentil 75</th>
            <th>Pools</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{OPERATION_BY_ID.get(row.id)?.label}</td>
              <td>{formatApy(row.p25)}</td>
              <td>{formatApy(row.median)}</td>
              <td>{formatApy(row.p75)}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
