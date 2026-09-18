"use client";

import { OPERATION_BY_ID, type YieldPool, type YieldSort } from "@/lib/yields";
import { ApyBar, Chips, OPERATION_COLOR, OperationIcon, ProtocolLogo, RiskLight, formatApy, formatPp, formatUsdCompact } from "./atoms";

// Tabla completa de pools. Cada fila se lee de izquierda a derecha como una
// frase: dónde, qué operación, cuánto rinde, hacia dónde va, cuánto hay
// depositado, qué condiciones tiene y qué señales de riesgo levanta.

export function PoolTable({
  rows,
  sort,
  dir,
  onSort,
  onOpen,
}: {
  rows: YieldPool[];
  sort: YieldSort;
  dir: "asc" | "desc";
  onSort: (sort: YieldSort) => void;
  onOpen: (pool: YieldPool) => void;
}) {
  // la barra satura en 60%: un APY de tres cifras no aplasta al resto de la página
  const scale = Math.max(5, ...rows.map((r) => Math.min(r.apy, 60)));

  const header = (label: string, key: YieldSort | null, className = "") => {
    const active = key !== null && sort === key;
    return (
      <th
        aria-sort={key === null ? undefined : active ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className={`border-b border-line px-2 pb-1.5 font-medium uppercase tracking-wide ${className}`}
      >
        {key === null ? (
          label
        ) : (
          <button type="button" onClick={() => onSort(key)} className="uppercase tracking-wide hover:text-ink">
            {label}
            {active && <span className="ml-1">{dir === "asc" ? "▲" : "▼"}</span>}
          </button>
        )}
      </th>
    );
  };

  return (
    <div className="max-h-[40rem] overflow-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="sticky top-0 z-[1] bg-card">
          <tr className="text-left text-[10px] text-ink-muted">
            {header("Pool", null, "pl-0")}
            {header("Operación", null, "hidden sm:table-cell")}
            {header("APY", "apy", "text-right")}
            {header("30 días", "trend", "text-right")}
            {header("Depositado", "tvl", "text-right")}
            {header("Plazo y condiciones", null, "hidden lg:table-cell")}
            {header("Riesgo", "risk")}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-xs text-ink-muted">
                Ningún pool coincide con estos filtros.
              </td>
            </tr>
          )}
          {rows.map((pool) => {
            const operation = OPERATION_BY_ID.get(pool.operation)!;
            const reward = pool.apyReward ?? 0;
            return (
              <tr
                key={pool.id}
                onClick={() => onOpen(pool)}
                className="group cursor-pointer border-b border-line/50 align-middle last:border-0 hover:bg-ice/30"
              >
                <td className="py-2 pr-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <ProtocolLogo project={pool.project} name={pool.projectName} size={20} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{pool.symbol}</span>
                      <span className="block truncate text-[10px] text-ink-muted">
                        {pool.projectName} · {pool.chain}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(pool);
                      }}
                      aria-label={`Ver histórico de ${pool.projectName} ${pool.symbol}`}
                      className="text-[10px] text-core opacity-0 transition-opacity hover:text-electric focus:opacity-100 group-hover:opacity-100"
                    >
                      ↗
                    </button>
                  </span>
                </td>
                <td className="hidden px-2 py-2 sm:table-cell">
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: OPERATION_COLOR[pool.operation] }}>
                    <OperationIcon id={pool.operation} size={14} />
                    <span className="text-ink-secondary">{operation.label}</span>
                  </span>
                </td>
                <td className="px-2 py-2 text-right">
                  <span className="block font-semibold tabular-nums">{formatApy(pool.apy)}</span>
                  <span className="ml-auto mt-1 block w-24">
                    <ApyBar pool={pool} scale={scale} />
                  </span>
                  {reward > 0 && (
                    <span className="mt-0.5 block text-[9px] text-ink-muted">{formatApy(reward)} en incentivos</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right text-[11px] tabular-nums">
                  {pool.apyChange30dPp === null ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <span className={pool.apyChange30dPp >= 0 ? "text-up" : "text-down"}>{formatPp(pool.apyChange30dPp)}</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatUsdCompact(pool.tvlUsd)}</td>
                <td className="hidden max-w-[16rem] px-2 py-2 lg:table-cell">
                  <Chips pool={pool} limit={3} />
                </td>
                <td className="py-2 pl-2">
                  <RiskLight pool={pool} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
