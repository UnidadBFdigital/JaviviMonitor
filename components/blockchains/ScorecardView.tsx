"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Unavailable } from "@/components/SourceBadge";
import type { ScoredNetwork } from "@/lib/bbi";
import { useBlockchains } from "./useBlockchains";
import { CATEGORY_LABELS, DataCoverage, metricValue, NetworkAnalysis } from "./NetworkAnalysis";

/** Solo las redes con TVL público tienen serie: las permissioned quedan sin ficha. */
const chainHistory = (n: ScoredNetwork) =>
  n.llamaName && n.tvlUsd !== null ? { kind: "chain-tvl" as const, id: n.llamaName, label: n.name } : null;

const columns: Column<ScoredNetwork>[] = [
  { key: "name", header: "Red", value: n => n.name, required: true },
  { key: "bbi", header: "BBI v2", numeric: true, value: n => n.bbi, render: n => <b className="text-gold">{n.bbi.toFixed(2)}{n.bbiPartial ? " *" : ""}</b> },
  { key: "activity", header: "Actividad /10", numeric: true, value: n => n.actividadEconomica, render: n => n.actividadEconomica?.toFixed(2) ?? "—" },
  { key: "institutional", header: "Institucional /10", numeric: true, value: n => n.institutionalScore, render: n => n.institutionalScore.toFixed(2) },
  { key: "coverage", header: "Cobertura %", numeric: true, value: n => n.activityCoverage },
  { key: "addresses", header: "Dir. activas 24h", numeric: true, value: n => n.activeAddresses24h, render: n => metricValue(n.activeAddresses24h, "count") },
  { key: "stables", header: "Stablecoins USD", numeric: true, value: n => n.stablecoinSupplyUsd, render: n => metricValue(n.stablecoinSupplyUsd) },
  { key: "tvl", header: "TVL USD", numeric: true, value: n => n.tvlUsd, render: n => metricValue(n.tvlUsd) },
  { key: "dex", header: "DEX 24h USD", numeric: true, value: n => n.dexVolume24hUsd, render: n => metricValue(n.dexVolume24hUsd) },
  { key: "fees", header: "Fees red 24h USD", numeric: true, value: n => n.chainFees24hUsd, render: n => metricValue(n.chainFees24hUsd) },
  ...(["seguridad", "adopcion", "escalabilidad", "ecosistema", "institucional", "compliance"] as const).map(key => ({ key, header: CATEGORY_LABELS[key], numeric: true, value: (n: ScoredNetwork) => n.scores[key] })),
];
const VIEWS = {
  bbi: { label: "BBI general", key: "bbi", description: "40% actividad observable y 60% criterios editoriales. Solo redes públicas con los cinco indicadores disponibles.", value: (n: ScoredNetwork) => n.bbi },
  activity: { label: "Uso y actividad", key: "activity", description: "Solo las cinco métricas observables. El encaje institucional y las notas editoriales no alteran este orden.", value: (n: ScoredNetwork) => n.actividadEconomica ?? 0 },
  institutional: { label: "Encaje institucional", key: "institutional", description: "50% institucional, 30% monitoreo y 20% seguridad. Opinión editorial; incluye redes privadas y no equivale a autorización regulatoria.", value: (n: ScoredNetwork) => n.institutionalScore },
};

export function ScorecardView() {
  const { data, error } = useBlockchains();
  const [view, setView] = useState<keyof typeof VIEWS>("bbi");
  if (error) return <Unavailable source="Blockchain Intelligence" />;
  if (!data) return <div className="h-96 animate-pulse rounded-lg bg-ice/50" />;
  const current = VIEWS[view];
  const ranked = data.networks.filter(n => view === "institutional" || n.comparable).sort((a, b) => current.value(b) - current.value(a));
  const partial = data.networks.filter(n => !n.comparable);
  return <div className="space-y-4">
    <DataCoverage data={data} />
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Enfoque del ranking">
        {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map(key => <button key={key} onClick={() => setView(key)} aria-pressed={view === key} className={`rounded border px-3 py-2 text-xs ${view === key ? "border-electric bg-electric/15 text-ink" : "border-line text-ink-secondary hover:bg-ice"}`}>{VIEWS[key].label}</button>)}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-secondary">{current.description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{ranked.slice(0, 3).map((network, index) =>
        <article key={network.name} className="rounded border border-line bg-card-raised p-4">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted">#{index + 1} · {current.label}</p>
          <div className="mt-2 flex items-baseline justify-between gap-2"><h3 className="text-xl font-semibold">{network.name}</h3><span className="text-lg font-bold tabular-nums text-gold">{current.value(network).toFixed(2)}</span></div>
          <p className="mt-2 text-[11px] text-ink-secondary">{view === "institutional" ? network.group : `${metricValue(network.activeAddresses24h, "count")} direcciones · ${metricValue(network.stablecoinSupplyUsd)} stablecoins`}</p>
        </article>)}
      </div>
      {!ranked.length && <p className="py-5 text-sm text-warn">Cobertura insuficiente para un ranking comparable. Revisá las métricas disponibles y las fichas parciales.</p>}
    </section>
    <NetworkAnalysis networks={data.networks} />
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Comparador · {current.label}</h3><p className="mb-3 mt-1 text-xs text-ink-secondary">{ranked.length} redes. Buscar, ordenar, elegir columnas y exportar valores originales a CSV.</p>
      <DataTable key={view} rows={ranked} columns={columns} initialSort={{ key: current.key, dir: "desc" }} exportName={`bbim-v2-${view}`} maxHeight="max-h-[36rem]" rowHistory={chainHistory} />
    </section>
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Especialización por caso de uso</h3><p className="mt-1 text-xs text-ink-secondary">Cada objetivo tiene pesos propios. El índice de pagos aproxima capacidad y alcance; no mide liquidaciones efectivas.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">{data.recommendations.map(item => <article key={item.useCase} className="rounded border border-line bg-card-raised p-3">
        <p className="text-[10px] uppercase tracking-widest text-electric">{item.useCase}</p><p className="mt-1 text-lg font-semibold">{item.leader} <span className="float-right text-gold">{item.score.toFixed(2)}</span></p>
        <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{item.rationale}</p><p className="mt-2 text-[11px] text-ink-muted">Alternativas: {item.alternatives.join(" · ") || "—"}</p>
      </article>)}</div>
    </section>
    <details className="rounded-lg border border-line bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold">Metodología, ponderadores y límites · BBI v2</summary>
      <p className="mt-3 text-xs leading-relaxed text-ink-secondary">{data.methodology.activity} La ponderación y las anclas son decisiones editoriales explícitas; no una ley económica. El corte de 24h puede ser volátil y no demuestra adopción sostenida.</p>
      <div className="mt-3 flex flex-wrap gap-2">{Object.entries(data.weights).map(([key, weight]) => <span key={key} className="rounded border border-line px-2 py-1 text-[11px]">{CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]} {weight}%</span>)}</div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[540px] text-xs"><thead><tr className="text-left text-ink-muted"><th className="pb-2">Indicador</th><th>Peso en actividad</th><th>Nota 1</th><th>Nota 10</th></tr></thead><tbody>{data.methodology.metrics.map(m => <tr key={m.key} className="border-t border-line"><td className="py-2">{m.label}</td><td>{m.weight}%</td><td>{metricValue(m.floor, m.unit)}</td><td>{metricValue(m.ceiling, m.unit)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs leading-relaxed text-ink-secondary">Cada métrica positiva usa 1 + 9 × log(valor / ancla inferior) / log(ancla superior / ancla inferior), limitada a [1, 10]. Un cero observado puntúa 0. Se necesitan al menos 3 métricas y 60% de cobertura para calcular actividad; sus pesos se renormalizan si faltan datos. Solo 100% de cobertura habilita el podio comparable.</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-secondary">TVL y stablecoins pueden solaparse: se puntúan por separado y su suma bruta no entra en la fórmula. Las redes sin actividad pública se muestran como parciales; la ausencia de datos no constituye evidencia de baja actividad.</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-secondary">El BBI no incluye volumen de transferencias de stablecoins: aún falta una fuente homogénea para todo el universo. Los datos históricos específicos se identifican en cada ficha, con su período y proveedor.</p>
    </details>
    {partial.length > 0 && <details className="rounded-lg border border-line bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold">Fuera del podio comparable · {partial.length} redes</summary>
      <ul className="my-3 space-y-2 text-xs text-ink-secondary">{partial.map(n => <li key={n.name}><b className="text-ink">{n.name}</b> · cobertura {n.activityCoverage}% · {n.tvlExcludedReason ?? "La fuente no publica todos los indicadores comparables."}</li>)}</ul>
      <DataTable rows={partial} columns={columns} exportName="bbim-v2-parciales" rowHistory={chainHistory} />
    </details>}
    <section className="rounded-lg border border-line bg-card p-4"><h3 className="text-sm font-semibold">Lecturas del corte</h3><ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-secondary">{data.insights.map(text => <li key={text}>{text}</li>)}</ul></section>
  </div>;
}
