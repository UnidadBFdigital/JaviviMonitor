"use client";

import { useState } from "react";

import type { NetworkMetrics } from "@/lib/networks/types";
import { INDEX_NAME, toolingScore } from "@/lib/networks/score";
import { Info, Na, formatCost, formatCount, formatUsd, formatPctValue } from "./atoms";
import { PillarRadar } from "./PillarRadar";
import { activeAddresses, feesPerActiveUser } from "@/lib/networks/series";
import { useIntel } from "./useNetworkIntel";

// Comparador cara a cara. La fila resalta al líder con un filete dorado a la
// izquierda de la celda, no pintando la celda entera: en una matriz de cinco
// columnas el color de fondo compite con la cifra. Primero lo que existe para
// todas las redes; al final, separado y rotulado, el detalle que solo publica
// growthepie para Ethereum y sus L2.

const MAX = 5;

type MetricRow = {
  label: string;
  definition: string;
  format: (n: NetworkMetrics) => string;
  value: (n: NetworkMetrics) => number | null;
  /** true = el valor más bajo es el mejor */
  lowerIsBetter?: boolean;
  /** sin líder: la cifra describe, no es mejor ni peor */
  neutral?: boolean;
  reason?: (n: NetworkMetrics) => string | null;
};

const ROWS: MetricRow[] = [
  {
    label: "Comisión por usuario activo",
    definition: "Comisiones de red de 24h ÷ direcciones activas. No es el costo de una transacción.",
    format: (n) => formatCost(feesPerActiveUser(n).value),
    value: (n) => feesPerActiveUser(n).value,
    lowerIsBetter: true,
    reason: (n) => feesPerActiveUser(n).source,
  },
  {
    label: "Comisiones de red 24h",
    definition: "Lo que pagaron todos los usuarios en comisiones en el día. Mide demanda, no costo unitario.",
    format: (n) => formatUsd(n.liquidity.chainFees24hUsd),
    value: (n) => n.liquidity.chainFees24hUsd,
    neutral: true,
  },
  {
    label: "Usuarios activos 24h",
    definition: "Direcciones activas. No equivale a personas únicas.",
    format: (n) => formatCount(activeAddresses(n).value),
    value: (n) => activeAddresses(n).value,
    reason: (n) => activeAddresses(n).source,
  },
  {
    label: "TVL",
    definition: "Capital depositado en protocolos DeFi.",
    format: (n) => formatUsd(n.liquidity.tvlUsd),
    value: (n) => n.liquidity.tvlUsd,
  },
  {
    label: "Variación del TVL 30d",
    definition: "Promedio de los últimos 30 días contra los 30 previos.",
    format: (n) => formatPctValue(n.liquidity.tvlChange30dPct),
    value: (n) => n.liquidity.tvlChange30dPct,
  },
  {
    label: "Stablecoins",
    definition: "Oferta en circulación en la red.",
    format: (n) => formatUsd(n.liquidity.stablecoinUsd),
    value: (n) => n.liquidity.stablecoinUsd,
  },
  {
    label: "Volumen DEX 24h",
    definition: "Intercambios spot en DEX de la red.",
    format: (n) => formatUsd(n.liquidity.dexVolume24hUsd),
    value: (n) => n.liquidity.dexVolume24hUsd,
  },
  {
    label: "Protocolos activos",
    definition: "Protocolos con TVL rastreado.",
    format: (n) => formatCount(n.liquidity.protocols),
    value: (n) => n.liquidity.protocols,
  },
  {
    label: "TVL de RWA",
    definition: "Protocolos de activos reales atribuidos a la red como principal.",
    format: (n) => formatUsd(n.rwa.tvlUsd),
    value: (n) => n.rwa.tvlUsd,
  },
  {
    label: "Commits 12 semanas",
    definition: "Repositorio núcleo. No son desarrolladores del ecosistema.",
    format: (n) => formatCount(n.dev.commits12w),
    value: (n) => n.dev.commits12w,
    reason: (n) => n.dev.unavailable,
  },
  {
    label: "Variación de commits",
    definition: "12 semanas contra las 12 previas.",
    format: (n) => formatPctValue(n.dev.commitsChangePct),
    value: (n) => n.dev.commitsChangePct,
  },
  {
    label: "Stack de desarrollo",
    definition: "Completitud del tooling registrado: frameworks, faucet, grants, oráculos, indexadores y SDK.",
    format: (n) => `${toolingScore(n).toFixed(1)}/10`,
    value: (n) => toolingScore(n),
  },
  {
    label: "Compatible con EVM",
    definition: "Un contrato de Ethereum se porta sin reescribirse.",
    format: (n) => (n.tooling.evm ? "Sí" : "No"),
    value: (n) => (n.tooling.evm ? 1 : 0),
    neutral: true,
  },
  {
    label: "Seguridad",
    definition: "L2: stage y riesgos de L2BEAT. L1: nota editorial del BBI.",
    format: (n) => (n.arch.securityScore === null ? "—" : `${n.arch.securityScore.toFixed(1)}/10`),
    value: (n) => n.arch.securityScore,
    reason: (n) => n.arch.securityBasis,
  },
];

const EVM_ROWS: MetricRow[] = [
  {
    label: "Costo mediano por transacción",
    definition: "Mediana en USD del día publicado por growthepie.",
    format: (n) => formatCost(n.cost.medianUsd),
    value: (n) => n.cost.medianUsd,
    lowerIsBetter: true,
  },
  {
    label: "Transacciones por segundo",
    definition: "Transacciones del día ÷ 86.400. Nunca el TPS teórico.",
    format: (n) => (n.activity.observedTps === null ? "—" : n.activity.observedTps.toFixed(1)),
    value: (n) => n.activity.observedTps,
  },
];

function MetricLine({ row, networks }: { row: MetricRow; networks: NetworkMetrics[] }) {
  const values = networks.map((n) => row.value(n));
  const present = values.filter((v): v is number => v !== null);
  const leader =
    !row.neutral && present.length > 1 ? (row.lowerIsBetter ? Math.min(...present) : Math.max(...present)) : null;
  return (
    <tr className="border-b border-line/60 last:border-0">
      <td className="py-1.5 text-ink-secondary">
        {row.label}
        <Info text={row.definition} />
      </td>
      {networks.map((network, i) => {
        const isLeader = leader !== null && values[i] === leader;
        return (
          <td key={network.id} className="py-1.5 text-right">
            <span
              className={`inline-block border-l-2 pl-1.5 tabular-nums ${
                isLeader ? "border-gold font-medium text-gold-bright" : "border-transparent"
              }`}
            >
              {values[i] === null ? <Na reason={row.reason?.(network)} /> : row.format(network)}
            </span>
          </td>
        );
      })}
    </tr>
  );
}

export function ComparatorPanel() {
  const { rows, scores } = useIntel();
  const [selected, setSelected] = useState<string[]>([]);

  const chosen = rows.filter((r) => selected.includes(r.network.id));
  const effective = chosen.length >= 2 ? chosen : rows.slice(0, 4);
  const networks = effective.map((r) => r.network);
  const showEvm = networks.some((n) => n.cost.medianUsd !== null || n.activity.observedTps !== null);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX ? prev : [...prev, id]
    );
  }

  const best = Math.max(...networks.map((n) => scores.get(n.id)?.score ?? -1));

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash" aria-hidden />
          Comparar redes
          <Info text="Las notas conservan la referencia del registro completo: seleccionar redes no cambia sus puntajes." />
        </h3>
        <p className="text-[11px] text-ink-secondary">
          {chosen.length >= 2 ? `${chosen.length} redes seleccionadas` : "Elegí de 2 a 5 redes · por defecto, las cuatro primeras del ranking"}
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {rows.map((row) => {
          const on = selected.includes(row.network.id);
          return (
            <button
              key={row.network.id}
              type="button"
              onClick={() => toggle(row.network.id)}
              aria-pressed={on}
              disabled={!on && selected.length >= MAX}
              className={`rounded border px-2 py-1 text-[11px] transition-colors disabled:opacity-40 ${
                on
                  ? "border-electric bg-electric/10 text-ink"
                  : "border-line text-ink-secondary hover:border-electric/60 hover:text-ink"
              }`}
            >
              {row.network.name}
            </button>
          );
        })}
        {selected.length > 0 && (
          <button type="button" onClick={() => setSelected([])} className="px-2 py-1 text-[11px] text-ink-muted hover:text-ink">
            limpiar
          </button>
        )}
      </div>

      <div className="mb-4 border-b border-line pb-4">
        <PillarRadar
          entries={networks.map((network) => ({ id: network.id, name: network.name, score: scores.get(network.id) }))}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[11px]">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th className="py-1.5 text-left font-medium">Métrica</th>
              {networks.map((network) => (
                <th key={network.id} className="py-1.5 text-right font-medium text-ink">
                  {network.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <MetricLine key={row.label} row={row} networks={networks} />
            ))}

            <tr className="border-t-2 border-line">
              <td className="py-2 font-medium">{INDEX_NAME}</td>
              {networks.map((network) => {
                const score = scores.get(network.id)?.score ?? null;
                return (
                  <td key={network.id} className="py-2 text-right">
                    <span
                      className={`inline-block border-l-2 pl-1.5 text-sm font-semibold tabular-nums ${
                        score !== null && score === best ? "border-gold text-gold-bright" : "border-transparent"
                      }`}
                    >
                      {score === null ? <Na /> : score.toFixed(0)}
                    </span>
                  </td>
                );
              })}
            </tr>

            {showEvm && (
              <>
                <tr>
                  <td colSpan={networks.length + 1} className="pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    Detalle solo para Ethereum y sus L2 · growthepie
                  </td>
                </tr>
                {EVM_ROWS.map((row) => (
                  <MetricLine key={row.label} row={row} networks={networks} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
