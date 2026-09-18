"use client";

import { OPERATIONS, type OperationId, type OperationSummary } from "@/lib/yields";
import { OPERATION_COLOR, OperationIcon, formatApy, formatUsdCompact } from "./atoms";

// "¿Qué querés hacer?": una tarjeta por tipo de operación con lo que hace, el
// rendimiento típico y cuánto capital hay. Tocar una filtra todo el explorador.

export function OperationCards({
  operations,
  selected,
  onSelect,
}: {
  operations: OperationSummary[];
  selected: OperationId | "all";
  onSelect: (id: OperationId | "all") => void;
}) {
  const byId = new Map(operations.map((o) => [o.id, o]));
  const totalPools = operations.reduce((sum, o) => sum + o.count, 0);
  const totalTvl = operations.reduce((sum, o) => sum + o.tvlUsd, 0);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <button
        type="button"
        onClick={() => onSelect("all")}
        aria-pressed={selected === "all"}
        className={`bf-reveal flex flex-col justify-between rounded-lg border p-3 text-left transition-colors ${
          selected === "all" ? "border-gold bg-gold/5" : "border-line bg-card hover:border-gold/50"
        }`}
      >
        <span>
          <span className="text-[13px] font-semibold">Todas las operaciones</span>
          <span className="mt-1 block text-[11px] leading-relaxed text-ink-secondary">
            Ver cualquier forma de hacer rendir tu dinero en DeFi.
          </span>
        </span>
        <span className="mt-3 block text-[11px] text-ink-muted">
          {totalPools.toLocaleString("es-BO")} pools · {formatUsdCompact(totalTvl)}
        </span>
      </button>

      {OPERATIONS.map((operation) => {
        const summary = byId.get(operation.id);
        const empty = !summary || summary.count === 0;
        const active = selected === operation.id;
        const color = OPERATION_COLOR[operation.id];
        return (
          <button
            key={operation.id}
            type="button"
            onClick={() => onSelect(active ? "all" : operation.id)}
            aria-pressed={active}
            disabled={empty && !active}
            className={`bf-reveal group flex flex-col justify-between rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              active ? "bg-card-raised" : "border-line bg-card hover:bg-card-raised"
            }`}
            style={active ? { borderColor: color } : undefined}
          >
            <span>
              <span className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                >
                  <OperationIcon id={operation.id} />
                </span>
                <span className="text-[13px] font-semibold">{operation.label}</span>
              </span>
              <span className="mt-1.5 line-clamp-3 block text-[11px] leading-relaxed text-ink-secondary">
                {operation.description}
              </span>
            </span>

            {empty ? (
              <span className="mt-3 block text-[11px] text-ink-muted">Sin pools con estos filtros</span>
            ) : (
              <span className="mt-3 block">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-ink-muted">Rinde típicamente</span>
                  <span className="text-lg font-semibold tabular-nums leading-none">{formatApy(summary.median)}</span>
                </span>
                <span className="mt-1 block text-[10px] text-ink-muted">
                  La mitad entre {formatApy(summary.p25)} y {formatApy(summary.p75)} · {summary.count.toLocaleString("es-BO")} pools ·{" "}
                  {formatUsdCompact(summary.tvlUsd)}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
