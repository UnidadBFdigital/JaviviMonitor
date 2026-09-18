"use client";

import { useState } from "react";
import { usePayload } from "@/lib/useSource";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatUsdCompact, formatPct, formatTimestamp } from "@/lib/format";
import { INDEX_FAMILIES, type IndexResult } from "@/lib/indices";

type Payload = {
  indices: IndexResult[];
  fetchedAt: string;
  sources: string[];
};

function formatValue(idx: IndexResult): string {
  if (idx.value === null) return "—";
  if (idx.unit === "usd") return formatUsdCompact(idx.value);
  return idx.value.toFixed(1);
}

function unitLabel(idx: IndexResult): string {
  if (idx.unit === "usd") return "";
  if (idx.unit === "base100") return "base 100";
  return "/ 100";
}

function IndexCard({ idx }: { idx: IndexResult }) {
  const [openMethod, setOpenMethod] = useState(false);

  // en un índice de riesgo, subir es malo: el color se invierte
  const changeTone =
    idx.changePct === null
      ? "text-ink-muted"
      : (idx.changePct >= 0) === idx.higherIsBetter
        ? "text-up"
        : "text-down";

  return (
    <section className="relative flex flex-col rounded-lg border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="rounded bg-electric/15 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-electric">
              {idx.code}
            </span>
            {!idx.higherIsBetter && (
              <span className="text-[9px] uppercase tracking-wider text-warn">más alto = peor</span>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold leading-snug">{idx.name}</h3>
        </div>
        <button
          onClick={() => setOpenMethod(!openMethod)}
          aria-expanded={openMethod}
          className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-secondary hover:bg-ice/50"
          title="Ver metodología"
        >
          Metodología
        </button>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tabular-nums leading-none">{formatValue(idx)}</p>
          <p className="mt-1 flex items-baseline gap-2">
            {unitLabel(idx) && (
              <span className="text-[10px] text-ink-muted">{unitLabel(idx)}</span>
            )}
            {idx.changePct !== null && (
              <span className={`text-xs tabular-nums ${changeTone}`}>
                {formatPct(idx.changePct)}
                {idx.changeLabel ? ` ${idx.changeLabel}` : ""}
              </span>
            )}
          </p>
        </div>
        {idx.spark && idx.spark.length > 1 ? (
          <Sparkline
            values={idx.spark}
            positive={
              idx.changePct === null ? undefined : (idx.changePct >= 0) === idx.higherIsBetter
            }
            width={96}
            height={34}
          />
        ) : null}
      </div>

      {idx.noHistory && (
        <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
          Sin sparkline: {idx.noHistory}
        </p>
      )}

      {openMethod && (
        <div className="mt-3 rounded border border-line/70 bg-card-raised p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-electric">
            Metodología
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{idx.methodology}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
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
      )}
    </section>
  );
}

export function IndicesGrid() {
  const { data, error } = usePayload<Payload>("/api/indices");

  if (error) return <p className="py-8 text-sm text-ink-muted">No disponible (error de red).</p>;
  if (!data)
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-lg bg-ice/50" />
        ))}
      </div>
    );

  const conSerie = data.indices.filter((i) => i.spark && i.spark.length > 1).length;

  return (
    <div className="space-y-5">
      {INDEX_FAMILIES.map((family) => {
        const items = data.indices.filter((i) => i.family === family);
        if (items.length === 0) return null;
        return (
          <div key={family}>
            <div className="mb-2 flex items-center gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                {family}
              </p>
              <div className="h-px flex-1 bg-line" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((idx) => (
                <IndexCard key={idx.code} idx={idx} />
              ))}
            </div>
          </div>
        );
      })}

      <p className="text-[11px] text-ink-muted">
        Fuentes: {data.sources.join(" · ")} — consultado {formatTimestamp(data.fetchedAt)}.{" "}
        {conSerie} de {data.indices.length} índices tienen serie histórica real; el resto muestra el
        valor sin sparkline en lugar de dibujar una línea inventada.
      </p>
    </div>
  );
}
