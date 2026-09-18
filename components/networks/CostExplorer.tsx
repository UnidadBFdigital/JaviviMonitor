"use client";

import { useState } from "react";
import { BarList } from "@/components/charts/BarList";
import { CATEGORICAL } from "@/lib/palette";
import { Delta, Info, Na, formatCost, formatCount, formatUsd } from "./atoms";
import { CostBudget } from "./CostBudget";
import { TrendLines, type TrendSeries } from "./TrendLines";
import { calendarValues, feesPerActiveUser } from "@/lib/networks/series";
import { useIntel } from "./useNetworkIntel";

// Cuánto cuesta usar cada red. La vista principal usa la única medida de
// costo que existe para todas: comisiones de red por usuario activo. El costo
// mediano por transacción de growthepie, más fino pero solo para Ethereum y
// sus L2, queda como detalle en su propia pestaña, rotulado como tal.

type View = "all" | "evm";

export function CostExplorer() {
  const { rows } = useIntel();
  const [view, setView] = useState<View>("all");
  const [showStats, setShowStats] = useState(false);

  const ranked = rows
    .map((row) => ({ row, fees: feesPerActiveUser(row.network) }))
    .filter((entry) => entry.fees.value !== null)
    .sort((a, b) => a.fees.value! - b.fees.value!);
  const missing = rows.filter((row) => feesPerActiveUser(row.network).value === null);

  const evm = rows.filter((r) => r.network.history.cost.length > 0);
  const series: TrendSeries[] = evm.map((r, i) => ({
    id: r.network.id,
    name: r.network.name,
    color: CATEGORICAL[i % CATEGORICAL.length],
    points: r.network.history.cost,
  }));

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash" aria-hidden />
          Cuánto cuesta usar cada red
          <Info text="Comisiones de red de las últimas 24h divididas por las direcciones activas del día. No es el costo de una transacción ni de un despliegue." />
        </h3>
        <div className="flex" role="group" aria-label="Vista de costo">
          {(
            [
              ["all", "Todas las redes"],
              ["evm", "Detalle EVM · por transacción"],
            ] as const
          ).map(([id, label], i) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={`border px-2.5 py-1 text-[11px] transition-colors ${i > 0 ? "-ml-px" : ""} ${
                view === id
                  ? "border-electric bg-electric/10 text-ink"
                  : "border-line text-ink-secondary hover:border-electric/60 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "all" ? (
        <>
          <p className="mb-3 max-w-3xl text-[11px] leading-relaxed text-ink-secondary">
            Lo que paga en comisiones, en promedio, cada usuario activo en un día. Menor es más barato para
            tus usuarios. Una cifra alta también puede reflejar operaciones de más valor —DeFi en Ethereum—
            y no solo una red cara.
          </p>
          {ranked.length === 0 ? (
            <p className="py-8 text-center text-xs text-ink-muted">Ninguna red del filtro actual publica comisiones y usuarios.</p>
          ) : (
            <BarList
              items={ranked.map(({ row, fees }) => ({
                label: row.network.name,
                value: fees.value!,
                note: `${formatUsd(row.network.liquidity.chainFees24hUsd)} en comisiones · ${formatCount(
                  (row.network.liquidity.chainFees24hUsd ?? 0) / fees.value!
                )} usuarios`,
              }))}
              formatValue={formatCost}
              showShare={false}
            />
          )}
          {missing.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-muted">
              Sin dato: {missing.map((r) => `${r.network.name} (${feesPerActiveUser(r.network).source})`).join(" · ")}.
            </p>
          )}
          <p className="mt-2 text-[10px] text-ink-muted">DeFiLlama · comisiones de red y direcciones activas de 24h · cada hora</p>
        </>
      ) : (
        <>
          <p className="mb-3 max-w-3xl text-[11px] leading-relaxed text-ink-secondary">
            Mediana diaria del costo de una transacción, en USD. growthepie la publica solo para Ethereum y sus L2
            ({evm.length} de {rows.length} redes del filtro): las demás no aparecen porque sus modelos de comisión
            —energía y ancho de banda en Tron, comisión por firma en Solana— no son esta misma medida.
          </p>

          {series.length === 0 ? (
            <p className="py-8 text-center text-xs text-ink-muted">
              Ninguna red del filtro actual tiene serie de costo por transacción.
            </p>
          ) : (
            <>
              <TrendLines series={series} log formatValue={formatCost} height={260} />

              <button
                type="button"
                onClick={() => setShowStats(!showStats)}
                aria-expanded={showStats}
                className="mt-3 text-[11px] text-core transition-colors hover:text-electric"
              >
                Estadísticos por red {showStats ? "▾" : "▸"}
              </button>

              {showStats && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[11px]">
                    <thead>
                      <tr className="border-b border-line text-left text-ink-muted">
                        <th className="py-1.5 font-medium">Red</th>
                        <th className="py-1.5 text-right font-medium">Última mediana</th>
                        <th className="py-1.5 text-right font-medium">Media 7d</th>
                        <th className="py-1.5 text-right font-medium">Media 30d</th>
                        <th className="py-1.5 text-right font-medium">Mín 30d</th>
                        <th className="py-1.5 text-right font-medium">Máx 30d</th>
                        <th className="py-1.5 text-right font-medium">
                          Volatilidad
                          <Info text="Coeficiente de variación a 30 días: desviación relativa a la media. Menor es más previsible." />
                        </th>
                        <th className="py-1.5 text-right font-medium">Δ 30d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evm.map((r) => (
                        <tr key={r.network.id} className="border-b border-line/60 last:border-0">
                          <td className="py-1.5">
                            {r.network.name}
                            <small className="block text-ink-muted">
                              {r.network.history.cost.at(-1)?.date} · {calendarValues(r.network.history.cost, 30).length}/30 días
                            </small>
                          </td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{formatCost(r.network.cost.medianUsd)}</td>
                          <td className="py-1.5 text-right tabular-nums text-ink-secondary">{formatCost(r.network.cost.avg7dUsd)}</td>
                          <td className="py-1.5 text-right tabular-nums text-ink-secondary">{formatCost(r.network.cost.avg30dUsd)}</td>
                          <td className="py-1.5 text-right tabular-nums text-ink-secondary">{formatCost(r.network.cost.min30dUsd)}</td>
                          <td className="py-1.5 text-right tabular-nums text-ink-secondary">{formatCost(r.network.cost.max30dUsd)}</td>
                          <td className="py-1.5 text-right tabular-nums text-ink-secondary">
                            {r.network.cost.volatility30d === null ? <Na /> : r.network.cost.volatility30d.toFixed(2)}
                          </td>
                          <td className="py-1.5 text-right">
                            {r.network.cost.change30dPct === null ? <Na /> : <Delta value={r.network.cost.change30dPct} invert />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <CostBudget networks={evm.map((r) => r.network)} />
            </>
          )}
          <p className="mt-2 text-[10px] text-ink-muted">growthepie · mediana diaria, hasta 90 días</p>
        </>
      )}
    </section>
  );
}
