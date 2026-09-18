"use client";

import { useState } from "react";
import { SourceBadge } from "@/components/SourceBadge";
import { WaterfallChart } from "@/components/charts/WaterfallChart";
import { formatPct, formatUsdCompact } from "@/lib/format";
import type {
  ProtocolIncomeStatement,
  ProtocolRevenue,
} from "@/lib/sources/defillama";
import type { SourceResult } from "@/lib/sources/types";
import { usePayload } from "@/lib/useSource";

type Payload = {
  ranking: SourceResult<ProtocolRevenue[]>;
  statement: SourceResult<ProtocolIncomeStatement>;
};

function Value({ value }: { value: number | null }) {
  return (
    <span className={value === null ? "text-ink-muted" : "tabular-nums"}>
      {value === null ? "—" : formatUsdCompact(value)}
    </span>
  );
}

export function IncomeStatementCard() {
  const [protocol, setProtocol] = useState("aave");
  const { data, error } = usePayload<Payload>(
    `/api/defi/income-statement?protocol=${encodeURIComponent(protocol)}`
  );

  const ranked = data?.ranking.ok ? data.ranking.data : [];
  const options = [
    ...new Map(
      [{ name: "Aave", slug: "aave" }, ...ranked].map((item) => [item.slug, item])
    ).values(),
  ];

  const statement = data?.statement.ok ? data.statement.data : null;
  const fees30d = statement?.lines.find((line) => line.key === "dailyFees")?.value30dUsd ?? null;
  const reportedCost30d =
    statement?.lines.find((line) => line.key === "dailySupplySideRevenue")?.value30dUsd ?? null;
  const revenue30d =
    statement?.lines.find((line) => line.key === "dailyRevenue")?.value30dUsd ?? null;
  const cost30d =
    reportedCost30d ?? (fees30d !== null && revenue30d !== null ? fees30d - revenue30d : null);

  return (
    <section className="rounded-lg border border-line bg-card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Estado de resultados por protocolo</h3>
          <p className="text-xs leading-relaxed text-ink-secondary">
            Fees, costo del lado de oferta, revenue retenido y distribución de valor.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-ink-muted">
          Protocolo
          <select
            value={protocol}
            onChange={(event) => setProtocol(event.target.value)}
            className="rounded border border-line bg-card-raised px-2 py-1.5 text-xs normal-case tracking-normal text-ink"
          >
            {options.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!data && !error && <div className="mt-4 h-72 animate-pulse rounded bg-ice/50" />}
      {(error || data?.statement.ok === false) && (
        <p className="py-10 text-center text-sm text-ink-muted">
          Estado financiero no disponible para este protocolo.
        </p>
      )}

      {statement && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[4fr_7fr]">
            <div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-line bg-card-raised p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                    Margen bruto 30d
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    {formatPct(statement.grossMargin30dPct)}
                  </p>
                </div>
                <div className="rounded border border-line bg-card-raised p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                    Revenue anualizado
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    {statement.annualizedRevenueUsd === null
                      ? "—"
                      : formatUsdCompact(statement.annualizedRevenueUsd)}
                  </p>
                </div>
              </div>
              {fees30d !== null && cost30d !== null && (
                <div className="mt-3 h-56">
                  <WaterfallChart
                    items={[
                      { name: "Fees", delta: fees30d },
                      { name: "Costo oferta", delta: -cost30d },
                    ]}
                    totalLabel="Revenue"
                    formatValue={formatUsdCompact}
                  />
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <div className="mb-2 flex items-baseline gap-2">
                <p className="text-base font-bold">{statement.name}</p>
                <span className="text-[10px] text-ink-muted">{statement.category}</span>
              </div>
              <table className="w-full min-w-[650px] border-collapse text-[11px]">
                <thead>
                  <tr className="text-[9px] uppercase tracking-wide text-ink-muted">
                    <th className="border-b border-line pb-1.5 pr-3 text-left font-medium">Línea</th>
                    <th className="border-b border-line px-2 pb-1.5 text-right font-medium">24h</th>
                    <th className="border-b border-line px-2 pb-1.5 text-right font-medium">7d</th>
                    <th className="border-b border-line px-2 pb-1.5 text-right font-medium">30d</th>
                    <th className="border-b border-line pl-2 pb-1.5 text-right font-medium">1 año</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.lines.map((line) => (
                    <tr
                      key={line.key}
                      className={`border-b border-line/50 last:border-0 ${
                        line.role === "profit" ? "bg-electric/5 font-semibold" : ""
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <span>{line.label}</span>
                        <span className="block max-w-sm text-[9px] font-normal leading-snug text-ink-muted">
                          {line.definition}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right"><Value value={line.value24hUsd} /></td>
                      <td className="px-2 py-2 text-right"><Value value={line.value7dUsd} /></td>
                      <td className="px-2 py-2 text-right"><Value value={line.value30dUsd} /></td>
                      <td className="py-2 pl-2 text-right"><Value value={line.value1yUsd} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
                Fees son la línea bruta; revenue es la porción retenida tras pagar al lado de oferta.
                Tokenholders y protocolo muestran cómo se asigna ese revenue cuando DeFiLlama dispone
                del desglose. “—” significa que el adaptador no reporta esa dimensión.
              </p>
            </div>
          </div>
          {data?.statement.ok && (
            <SourceBadge
              source={data.statement.source}
              fetchedAt={data.statement.fetchedAt}
              stale={data.statement.stale}
            />
          )}
        </>
      )}
    </section>
  );
}
