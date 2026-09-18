"use client";

import { Fragment, useState } from "react";
import { usePayload } from "@/lib/useSource";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatUsdCompact, formatPct, formatTimestamp } from "@/lib/format";
import { INDEX_FAMILIES, type IndexResult } from "@/lib/indices";

type Payload = { indices: IndexResult[]; fetchedAt: string; sources: string[] };

function level(idx: IndexResult): string {
  if (idx.value === null) return "—";
  if (idx.unit === "usd") return formatUsdCompact(idx.value);
  return idx.value.toFixed(1);
}

const SIGNAL_TONE: Record<IndexResult["signal"]["tone"], string> = {
  good: "text-up",
  bad: "text-down",
  flat: "text-ink-secondary",
  none: "text-ink-muted",
};

/** Celda de variación: el color sigue a la dirección DESEADA del índice, no
 *  al signo. En un índice de riesgo, subir es malo y se pinta en rojo. */
function Delta({ v, higherIsBetter }: { v: number | null; higherIsBetter: boolean }) {
  if (v === null) return <span className="text-ink-muted">—</span>;
  const bien = v >= 0 === higherIsBetter;
  const flat = Math.abs(v) < 0.05;
  return (
    <span className={flat ? "text-ink-secondary" : bien ? "text-up" : "text-down"}>
      {formatPct(v)}
    </span>
  );
}

// Los índices son la propiedad intelectual de Blockfinity: se leen como un
// terminal financiero (una fila por índice, columnas comparables), no como una
// grilla de fichas donde cada uno parece un widget aislado. La fila se
// despliega para ver metodología, insumos y lectura.
export function IndicesTerminal() {
  const { data, error } = usePayload<Payload>("/api/indices");
  const [abierto, setAbierto] = useState<string | null>(null);

  if (error) return <p className="py-8 text-sm text-ink-muted">No disponible (error de red).</p>;

  if (!data)
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="bf-shimmer h-11 rounded" />
        ))}
      </div>
    );

  return (
    <div className="bf-frame bf-premium-frame bf-reveal" style={{ "--bf-cut": "22px" } as React.CSSProperties}>
      <div className="bf-premium overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              <th className="border-b border-charcoal-line px-3 pb-2 pt-3 text-left font-medium">
                Índice
              </th>
              <th className="border-b border-charcoal-line px-3 pb-2 pt-3 text-right font-medium">
                Valor
              </th>
              <th className="border-b border-charcoal-line px-2 pb-2 pt-3 text-right font-medium">
                1D
              </th>
              <th className="border-b border-charcoal-line px-2 pb-2 pt-3 text-right font-medium">
                7D
              </th>
              <th className="border-b border-charcoal-line px-2 pb-2 pt-3 text-right font-medium">
                30D
              </th>
              <th className="border-b border-charcoal-line px-3 pb-2 pt-3 text-center font-medium">
                Tendencia
              </th>
              <th className="border-b border-charcoal-line px-3 pb-2 pt-3 text-right font-medium">
                Señal
              </th>
            </tr>
          </thead>

          {INDEX_FAMILIES.map((family) => {
            const items = data.indices.filter((i) => i.family === family);
            if (items.length === 0) return null;
            return (
              <tbody key={family}>
                <tr>
                  <td colSpan={7} className="px-3 pb-1 pt-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
                      {family}
                    </span>
                  </td>
                </tr>
                {items.map((idx) => {
                  const on = abierto === idx.code;
                  return (
                    <Fragment key={idx.code}>
                      <tr
                        onClick={() => setAbierto(on ? null : idx.code)}
                        className={`cursor-pointer border-b border-charcoal-line/60 transition-colors ${
                          on ? "bg-charcoal-raised" : "hover:bg-charcoal-raised/60"
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-bold tracking-wider text-gold">{idx.code}</span>
                          <span className="ml-2 text-[11px] text-ink-secondary">{idx.name}</span>
                          {!idx.higherIsBetter && (
                            <span className="ml-2 text-[9px] uppercase tracking-wide text-warn">
                              invertido
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[15px] font-bold tabular-nums">
                          {level(idx)}
                        </td>
                        <td className="px-2 py-2.5 text-right text-xs tabular-nums">
                          <Delta v={idx.changes.d1} higherIsBetter={idx.higherIsBetter} />
                        </td>
                        <td className="px-2 py-2.5 text-right text-xs tabular-nums">
                          <Delta v={idx.changes.d7} higherIsBetter={idx.higherIsBetter} />
                        </td>
                        <td className="px-2 py-2.5 text-right text-xs tabular-nums">
                          <Delta v={idx.changes.d30} higherIsBetter={idx.higherIsBetter} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center">
                            {idx.spark && idx.spark.length > 1 ? (
                              <Sparkline
                                values={idx.spark}
                                positive={
                                  idx.changes.d30 === null
                                    ? undefined
                                    : idx.changes.d30 >= 0 === idx.higherIsBetter
                                }
                                width={88}
                                height={24}
                              />
                            ) : (
                              <span
                                className="bf-hatch block h-3 w-[88px] rounded-sm"
                                title="Sin serie histórica"
                              />
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right text-[11px] font-medium ${SIGNAL_TONE[idx.signal.tone]}`}
                        >
                          {idx.signal.label}
                        </td>
                      </tr>

                      {on && (
                        <tr className="border-b border-charcoal-line/60">
                          <td colSpan={7} className="bg-charcoal-raised px-3 pb-4 pt-1">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
                                  Metodología
                                </p>
                                <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                                  {idx.methodology}
                                </p>
                                {idx.noHistory && (
                                  <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                                    <span className="text-warn">Sin serie: </span>
                                    {idx.noHistory}
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                                  Insumos
                                </p>
                                <ul className="mt-1 space-y-0.5">
                                  {idx.inputs.map((i) => (
                                    <li key={i} className="text-[11px] text-ink-secondary">
                                      · {i}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>

      <p className="bf-premium px-3 py-2.5 text-[11px] leading-relaxed text-ink-muted">
        Clic en una fila para ver metodología e insumos. Variaciones calculadas sobre la serie
        diaria de cada índice; la trama diagonal marca los que aún no tienen serie. Fuentes:{" "}
        {data.sources.join(" · ")} — consultado {formatTimestamp(data.fetchedAt)}.
      </p>
    </div>
  );
}
