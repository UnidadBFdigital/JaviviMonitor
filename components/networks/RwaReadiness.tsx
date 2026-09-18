"use client";

import { useState } from "react";
import Link from "next/link";
import { scoreUniverse } from "@/lib/networks/score";
import { Info, Na, ScoreBar, formatCost, formatUsd } from "./atoms";
import { useIntel } from "./useNetworkIntel";

// RWA Readiness — el ángulo propio de Blockfinity. No repite el scorecard
// institucional del BBI: aquel juzga a la red como contraparte, este mide si
// la infraestructura aguanta una emisión (liquidación en stablecoins, costo,
// finalidad, oráculos y RWA ya operando). El encaje institucional editorial
// se reutiliza tal cual, con enlace a su ficha.

export function RwaReadiness({ onOpen }: { onOpen: (id: string) => void }) {
  const { rows } = useIntel();
  // el ranking manda; los insumos quedan a un clic
  const [showTable, setShowTable] = useState(false);

  const rwaScores = scoreUniverse(rows.map((r) => r.network), "rwa");
  const ranked = [...rows]
    .map((row) => ({ row, score: rwaScores.get(row.network.id)?.score ?? null }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) => b.score! - a.score!)
    .slice(0, 8);

  return (
    <section className="rounded-lg border border-charcoal-line bf-premium p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash bf-slash-gold" aria-hidden />
          RWA Readiness
          <Info text="Perfil RWA del índice: seguridad 30%, adopción 25%, costo 15%, desarrollo 15% y rendimiento 15%, reforzando stablecoins, RWA on-chain, finalidad y oráculos." />
        </h3>
        <Link href="/blockchains/scorecard" className="text-[11px] text-core transition-colors hover:text-electric">
          Encaje institucional editorial en Scorecard &amp; BBI →
        </Link>
      </div>

      <p className="mb-3 max-w-3xl text-[11px] leading-relaxed text-ink-secondary">
        Mide si la infraestructura sostiene una emisión: con qué dinero se liquida, cuánto cuesta
        cada movimiento, cuán rápido es definitivo el asentamiento y si ya hay RWA operando en la
        red. No sustituye la evaluación legal ni de contraparte del emisor.
      </p>

      <div className="mb-4 space-y-1.5">
        {ranked.map(({ row, score }, index) => {
          const n = row.network;
          return (
            <div key={`bar-${n.id}`} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-right font-mono text-[10px] text-ink-muted">{index + 1}</span>
              <button
                type="button"
                onClick={() => onOpen(n.id)}
                className="w-28 shrink-0 truncate text-left text-[12px] font-medium transition-colors hover:text-electric"
              >
                {n.name}
              </button>
              <span className="h-3 min-w-0 flex-1 bg-ice/50">
                <span
                  className="bf-grow-x block h-full"
                  style={
                    {
                      width: `${score ?? 0}%`,
                      background: index === 0 ? "var(--color-gold)" : "var(--color-core)",
                      "--bf-i": index,
                    } as React.CSSProperties
                  }
                />
              </span>
              <span
                className={`w-8 shrink-0 text-right text-[11px] tabular-nums ${
                  index === 0 ? "text-gold-bright" : "text-ink"
                }`}
              >
                {score === null ? "—" : score.toFixed(0)}
              </span>
              <span className="hidden w-56 shrink-0 justify-end gap-2 text-[10px] text-ink-muted lg:flex">
                <span title="Liquidez en stablecoins">{formatUsd(n.liquidity.stablecoinUsd)} stbl</span>
                <span title="TVL de protocolos RWA atribuidos a esta red">{formatUsd(n.rwa.tvlUsd)} RWA</span>
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowTable(!showTable)}
        aria-expanded={showTable}
        className="text-[11px] text-core transition-colors hover:text-electric"
      >
        Ver los insumos del puntaje {showTable ? "▾" : "▸"}
      </button>

      <div className={`mt-2 overflow-x-auto ${showTable ? "" : "hidden"}`}>
        <table className="w-full min-w-[720px] text-[11px]">
          <thead>
            <tr className="border-b border-charcoal-line text-left text-ink-muted">
              <th className="py-1.5 font-medium">Red</th>
              <th className="py-1.5 text-right font-medium">Stablecoins</th>
              <th className="py-1.5 text-right font-medium">RWA on-chain</th>
              <th className="py-1.5 text-right font-medium">Costo</th>
              <th className="py-1.5 text-right font-medium">
                Finalidad
                <Info text="Segundos hasta finalidad económica; N/A cuando la red no publica un valor verificable." />
              </th>
              <th className="py-1.5 text-right font-medium">Seguridad</th>
              <th className="py-1.5 text-right font-medium">
                Institucional
                <Info text="Nota editorial del BBI reutilizada: institucional 50%, compliance 30%, seguridad 20%." />
              </th>
              <th className="py-1.5 text-right font-medium">Readiness</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ row, score }) => {
              const n = row.network;
              return (
                <tr key={n.id} className="border-b border-charcoal-line/60 last:border-0">
                  <td className="py-1.5">
                    <button
                      type="button"
                      onClick={() => onOpen(n.id)}
                      className="font-medium transition-colors hover:text-electric"
                    >
                      {n.name}
                    </button>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatUsd(n.liquidity.stablecoinUsd)}</td>
                  <td className="py-1.5 text-right tabular-nums" title={n.rwa.note}>
                    {formatUsd(n.rwa.tvlUsd)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {n.cost.medianUsd === null ? <Na reason={n.cost.unavailable} /> : formatCost(n.cost.medianUsd)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {n.arch.finalitySec === null ? <Na reason={n.finalityNote} /> : `${n.arch.finalitySec}s`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums" title={n.arch.securityBasis ?? undefined}>
                    {n.arch.securityScore === null ? <Na /> : n.arch.securityScore.toFixed(1)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {n.arch.institutionalScore === null ? (
                      <Na reason="La red no está en el universo editorial del BBI." />
                    ) : (
                      n.arch.institutionalScore.toFixed(1)
                    )}
                  </td>
                  <td className="py-1.5">
                    <span className="flex justify-end">
                      <ScoreBar value={score} gold />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
        RWA on-chain: DeFiLlama atribuye cada protocolo a una cadena principal, así que mide
        presencia y no el reparto real de un protocolo multichain. Los cuatro L2 nuevos no tienen
        ficha editorial en el BBI: su columna institucional queda vacía en vez de asumir un valor.
      </p>
    </section>
  );
}
