"use client";

import { useState } from "react";
import type { NetworkMetrics } from "@/lib/networks/types";
import { formatCost } from "./atoms";

export function CostBudget({ networks }: { networks: NetworkMetrics[] }) {
  const [operations, setOperations] = useState("100000");
  const parsed = Number(operations);
  const valid = operations.trim() !== "" && Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 1e12;
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">Escenario de gasto mensual</h4>
        <label className="flex items-center gap-2 text-xs text-ink-secondary">
          Transacciones al mes
          <input aria-label="Transacciones al mes" inputMode="numeric" type="number" min="0" max="1000000000000" step="1" value={operations} onChange={(e) => setOperations(e.target.value)} className="w-36 rounded border border-line bg-card-raised px-2 py-1.5 text-ink" />
        </label>
      </div>
      <p className="my-2 text-[11px] leading-relaxed text-ink-secondary">Referencia orientativa: cantidad × media de medianas diarias de 30 días. El intervalo usa la menor y mayor mediana observadas; no es un intervalo de confianza ni una cotización de swaps, despliegues o transferencias. Excluye RPC, infraestructura, puentes y subsidios.</p>
      {!valid ? <p role="alert" className="text-xs text-down">Introduce un entero entre 0 y 1.000.000.000.000.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-line text-left text-ink-muted"><th className="py-2">Red</th><th className="text-right">Referencia / mes</th><th className="text-right">Mín.–máx. observado × cantidad</th></tr></thead><tbody>
          {networks.filter((n) => n.cost.avg30dUsd !== null).sort((a,b) => a.cost.avg30dUsd! - b.cost.avg30dUsd!).map((n) => <tr key={n.id} className="border-b border-line/60"><td className="py-2">{n.name}</td><td className="text-right tabular-nums">{formatCost(n.cost.avg30dUsd! * parsed)}</td><td className="text-right tabular-nums text-ink-secondary">{formatCost(n.cost.min30dUsd === null ? null : n.cost.min30dUsd * parsed)} – {formatCost(n.cost.max30dUsd === null ? null : n.cost.max30dUsd * parsed)}</td></tr>)}
        </tbody></table></div>
      )}
    </div>
  );
}
