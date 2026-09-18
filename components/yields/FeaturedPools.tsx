"use client";

import { OPERATION_BY_ID, type YieldPool } from "@/lib/yields";
import { ApyBar, Chips, OPERATION_COLOR, OperationIcon, ProtocolLogo, RiskLight, formatApy, formatPp, formatUsdCompact } from "./atoms";

// Mejores opciones: el mayor rendimiento entre pools grandes, sin pérdida
// impermanente y sin señales de riesgo relevantes, uno por protocolo. Tarjetas
// grandes para leer de un vistazo qué es, cuánto rinde y qué condiciones tiene.

export function FeaturedPools({ pools, onOpen }: { pools: YieldPool[]; onOpen: (pool: YieldPool) => void }) {
  if (pools.length === 0) {
    return (
      <p className="py-10 text-center text-xs leading-relaxed text-ink-muted">
        Con estos filtros no hay pools de más de $10M sin señales de riesgo. Probá otro activo u operación, o mirá la tabla completa.
      </p>
    );
  }

  const scale = Math.max(...pools.map((p) => p.apy), 1);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {pools.map((pool) => {
        const operation = OPERATION_BY_ID.get(pool.operation)!;
        const color = OPERATION_COLOR[pool.operation];
        const reward = pool.apyReward ?? 0;
        return (
          <button
            key={pool.id}
            type="button"
            onClick={() => onOpen(pool)}
            className="bf-reveal group flex flex-col gap-2 rounded-lg border border-line bg-card-raised p-3 text-left transition-colors hover:border-electric/50"
          >
            <span className="flex items-center gap-2">
              <ProtocolLogo project={pool.project} name={pool.projectName} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold">{pool.projectName}</span>
                <span className="block truncate text-[10px] text-ink-muted">{pool.chain}</span>
              </span>
              <span className="flex items-center gap-1 text-[10px]" style={{ color }}>
                <OperationIcon id={pool.operation} size={14} />
                {operation.label}
              </span>
            </span>

            <span className="flex items-end justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-[11px] text-ink-secondary">{pool.symbol}</span>
                <span className="block text-2xl font-semibold tabular-nums leading-none">{formatApy(pool.apy)}</span>
              </span>
              <span className="shrink-0 text-right text-[10px] text-ink-muted">
                <span className="block">APY anual</span>
                {pool.apyChange30dPp !== null && (
                  <span className={pool.apyChange30dPp >= 0 ? "text-up" : "text-down"}>{formatPp(pool.apyChange30dPp)} en 30d</span>
                )}
              </span>
            </span>

            <span className="block">
              <ApyBar pool={pool} scale={scale} />
              {reward > 0 && (
                <span className="mt-1 block text-[10px] text-ink-muted">
                  {formatApy(pool.apyBase ?? pool.apy - reward)} base · {formatApy(reward)} en tokens de incentivo
                </span>
              )}
            </span>

            <Chips pool={pool} limit={3} />

            <span className="mt-auto flex items-center justify-between gap-2 border-t border-line/70 pt-2 text-[10px] text-ink-muted">
              <span>{formatUsdCompact(pool.tvlUsd)} depositados</span>
              <RiskLight pool={pool} compact />
              <span className="text-core transition-colors group-hover:text-electric">Ver histórico →</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
