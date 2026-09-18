"use client";

import { useState } from "react";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { formatUsdCompact } from "@/lib/format";
import { useBlockchains, GroupChip } from "./useBlockchains";
import { BubbleChart } from "@/components/charts/BubbleChart";
import { DataCoverage, Evidence } from "./NetworkAnalysis";

// Blockchain Risk Profile — el producto que el Excel identifica como el
// monetizable directo de Compliance Solutions. Combina la capa 1 (modelo de
// trazabilidad, privacidad) con la capa 4 (aceptación institucional) y el
// score editorial de monitoreo, que no equivale a una evaluación jurídica.

function riskTone(score: number): { label: string; cls: string } {
  if (score >= 8) return { label: "Amplia", cls: "bg-up/15 text-up" };
  if (score >= 6) return { label: "Intermedia", cls: "bg-electric/15 text-electric" };
  return { label: "Limitada", cls: "bg-warn/15 text-warn" };
}

export function RiskView() {
  const { data, error } = useBlockchains();
  const [query, setQuery] = useState("");

  if (error) return <Unavailable source="DeFiLlama" />;
  if (!data)
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-lg bg-ice/50" />
        <div className="h-96 animate-pulse rounded-lg bg-ice/50" />
      </div>
    );

  // mayor score de compliance = menor fricción; empata por adopción institucional
  const ordenadas = [...data.networks].sort(
    (a, b) =>
      b.scores.compliance - a.scores.compliance || b.scores.institucional - a.scores.institucional
  );

  const aptas = ordenadas.filter((n) => n.scores.compliance >= 8).length;
  const conFriccion = ordenadas.filter((n) => n.scores.compliance <= 5).length;

  // Contraste entre dos notas editoriales, sin inferir volumen transaccional.
  const brecha = ordenadas
    .filter((n) => n.scores.adopcion >= 8 && n.scores.institucional <= 4)
    .sort((a, b) => b.scores.adopcion - a.scores.adopcion);

  return (
    <div className="space-y-4">
      <DataCoverage data={data} />
      <section className="rounded-lg border border-line bg-card px-4 py-3">
        <h3 className="text-sm font-semibold">Tres dimensiones que se evalúan por separado</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink-secondary">Uso de la red, herramientas de monitoreo y exposición regulatoria responden preguntas diferentes. Una red con mucha actividad puede tener controles de trazabilidad desarrollados y riesgos de contraparte. El score editorial de monitoreo no mide criminalidad ni determina si una institución puede operar.</p>
      </section>
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 rounded-lg border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Monitoreo amplio
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-up">{aptas}</p>
          <p className="mt-1.5 text-[11px] text-ink-secondary">
            de {ordenadas.length} redes · nota editorial ≥ 8
          </p>
        </div>
        <div className="flex-1 rounded-lg border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Monitoreo limitado
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-down">
            {conFriccion}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-secondary">nota editorial ≤ 5 · revisar herramientas disponibles</p>
        </div>
        <div className="flex-1 rounded-lg border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Brecha editorial de adopción / encaje
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-warn">
            {brecha.length}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-secondary">
            {brecha.length > 0 ? brecha.map((n) => n.name).join(", ") : "ninguna"}
          </p>
        </div>
      </div>

      {brecha.length > 0 && (
        <div className="rounded-lg border border-warn/40 bg-warn/5 px-4 py-3">
          <p className="text-xs leading-relaxed text-ink-secondary">
            {brecha.map((n) => n.name).join(" y ")}: adopción editorial alta y encaje institucional editorial bajo.
            Esta diferencia orienta la revisión de casos de uso; no demuestra volumen de pagos ni una prohibición de operar.
          </p>
        </div>
      )}

      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Matriz de decisión institucional</h3>
        <p className="mb-3 text-xs leading-relaxed text-ink-secondary">
          Derecha = índice de actividad observable; arriba = capacidad editorial de monitoreo.
          Tamaño = oferta de stablecoins, no volumen de pagos. Solo redes con ambos datos observables.
        </p>
        <div className="h-96">
          <BubbleChart
            points={data.networks.filter(network => network.actividadEconomica !== null && network.stablecoinSupplyUsd !== null && network.stablecoinSupplyUsd > 0).map((network) => ({
              name: network.name,
              x: network.actividadEconomica!,
              y: network.scores.compliance,
              z: network.stablecoinSupplyUsd!,
              group: network.group,
            }))}
            xLabel="Actividad observable"
            yLabel="Monitoreo editorial"
            zLabel="Oferta de stablecoins"
            formatX={(value) => `${value.toFixed(0)}/10`}
            formatY={(value) => `${value.toFixed(0)}/10`}
            formatZ={formatUsdCompact}
            logarithmic={false}
          />
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">
          La posición combina actividad medida y criterio editorial. Las redes sin datos comparables
          se mantienen en las fichas, sin inventar un tamaño de burbuja.
        </p>
      </section>

      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Perfil de riesgo por red</h3>
        <label className="my-3 block text-xs text-ink-secondary">Buscar red
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre o grupo" className="ml-3 rounded border border-line bg-surface px-3 py-2 text-ink" />
        </label>
        <p className="mb-3 text-xs text-ink-secondary">
          Modelo de trazabilidad, mecanismos de privacidad y capacidad de monitoreo — los tres
          insumos de una política AML diferenciada por blockchain.
        </p>
        <div className="space-y-3">
          {ordenadas.filter(n => `${n.name} ${n.group}`.toLowerCase().includes(query.toLowerCase().trim())).map((n) => {
            const tone = riskTone(n.scores.compliance);
            return (
              <div key={n.name} className="rounded border border-line/70 bg-card-raised p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h4 className="text-sm font-semibold">{n.name}</h4>
                    <GroupChip group={n.group} />
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone.cls}`}>
                      Monitoreo: {tone.label}
                    </span>
                  </div>
                  <span className="text-[11px] tabular-nums text-ink-muted">
                    monitoreo editorial {n.scores.compliance}/10 · institucional {n.scores.institucional}/10
                    {n.tvlUsd !== null && ` · TVL ${formatUsdCompact(n.tvlUsd)}`}
                  </span>
                </div>

                <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-2">
                  {(
                    [
                      ["Trazabilidad", n.traceability],
                      ["Privacidad", n.privacy],
                      ["Monitoreo", n.monitoring],
                      ["Contexto regulatorio editorial", n.regulatoryRisk],
                      ["Consenso", n.consensus],
                      ["Adopción institucional", n.institutionalAdoption],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <div key={k} className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-2">
                      <dt className="text-ink-muted">{k}</dt>
                      <dd className="min-w-0 break-words text-ink-secondary">{v}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-2 border-t border-line/60 pt-2 text-[12px] leading-relaxed text-ink-secondary">
                  {n.note}
                </p>
                <Evidence network={n} />
              </div>
            );
          })}
        </div>
        {data.source.ok && (
          <SourceBadge
            source={`Perfiles de riesgo curados por Blockfinity al ${data.asOf} — TVL de ${data.source.source}`}
            fetchedAt={data.source.fetchedAt}
            stale={data.source.stale}
          />
        )}
      </section>
    </div>
  );
}
