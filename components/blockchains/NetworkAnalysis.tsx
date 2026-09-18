"use client";

import { useState } from "react";
import { formatUsdCompact } from "@/lib/format";
import { ACTIVITY_METRICS } from "@/lib/bbiMethodology";
import type { Network, ScoredNetwork, Weights } from "@/lib/bbi";
import type { BbimPayload } from "./useBlockchains";
import { SourceBadge } from "@/components/SourceBadge";

export const CATEGORY_LABELS: Record<keyof Weights, string> = {
  seguridad: "Seguridad", adopcion: "Adopción editorial", actividadEconomica: "Actividad observable",
  escalabilidad: "Escalabilidad", ecosistema: "Ecosistema", institucional: "Encaje institucional", compliance: "Monitoreo y controles",
};
export const metricValue = (value: number | null, unit: "usd" | "count" = "usd") => value === null ? "—" : unit === "usd" ? formatUsdCompact(value) : new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 2 }).format(value);

export function Evidence({ network }: { network: Network }) {
  if (!network.review) return <p className="mt-3 text-[11px] text-ink-muted">Evaluación editorial del corte base. Sin revisión individual con referencias adjuntas.</p>;
  return <div className="mt-3 border-t border-line pt-3">
    <p className="text-[11px] font-semibold text-ink">Revisión documentada · {network.review.reviewedAt}</p>
    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{network.review.rationale}</p>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
      {network.review.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-[11px] text-electric underline underline-offset-2">{source.label} ↗</a>)}
    </div>
  </div>;
}

export function DataCoverage({ data }: { data: BbimPayload }) {
  const comparable = data.networks.filter(n => n.comparable).length;
  return <section className="rounded-lg border border-line bg-card px-4 py-3">
    <div className="flex flex-wrap justify-between gap-2 text-xs">
      <span className="font-semibold">BBI {data.methodology.version} · {comparable}/{data.networks.length} redes con cobertura completa</span>
      <span className="text-ink-muted">Base editorial: {data.asOf} · revisiones individuales indicadas en cada ficha</span>
    </div>
    <div className="flex flex-wrap gap-x-6">
      {[data.source, data.stablecoinSource, data.activity].map(source => source.ok
        ? <SourceBadge key={source.source} source={source.source} fetchedAt={source.fetchedAt} stale={source.stale} />
        : <p key={source.source} className="mt-2 text-[11px] text-warn">{source.source}: sin respuesta; se muestran otras fuentes disponibles.</p>)}
    </div>
    <p className="mt-2 text-[11px] text-ink-muted">Los cortes de cada fuente pueden diferir. Datos ausentes = —; cero solo cuando la fuente publica cero. Un índice parcial no entra en el podio comparable.</p>
  </section>;
}

export function NetworkAnalysis({ networks }: { networks: ScoredNetwork[] }) {
  const [selected, setSelected] = useState("Tron");
  const network = networks.find(n => n.name === selected) ?? networks[0];
  if (!network) return null;
  const peers = networks.filter(n => n.comparable);
  const rank = network.comparable ? 1 + peers.filter(n => n.bbi > network.bbi).length : null;
  return <section className="rounded-lg border border-gold/35 bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-semibold uppercase tracking-widest text-gold">Explicación del ranking</p><h3 className="mt-1 text-lg font-semibold">{network.name}: actividad, fortalezas y límites</h3></div>
      <label className="text-xs text-ink-secondary">Analizar red
        <select aria-label="Analizar red" value={network.name} onChange={event => setSelected(event.target.value)} className="ml-2 rounded border border-line bg-surface px-3 py-2 text-ink">
          {[...networks].sort((a, b) => a.name.localeCompare(b.name)).map(n => <option key={n.name}>{n.name}</option>)}
        </select>
      </label>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[["BBI general", `${network.bbi.toFixed(2)}/10`, rank ? `#${rank} de ${peers.length} comparables` : "Parcial · fuera del podio"],
        ["Actividad observable", network.actividadEconomica === null ? "—" : `${network.actividadEconomica.toFixed(2)}/10`, "Cinco métricas independientes"],
        ["Encaje institucional", `${network.institutionalScore.toFixed(2)}/10`, "Evaluación editorial, no autorización"],
        ["Cobertura de actividad", `${network.activityCoverage}%`, `${network.activityComponents.filter(c => c.value !== null).length}/5 indicadores disponibles`]].map(([label, value, note]) =>
        <div key={label} className="rounded border border-line bg-card-raised p-3"><p className="text-[10px] text-ink-muted">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-[10px] text-ink-secondary">{note}</p></div>)}
    </div>
    <div className="mt-4 grid gap-5 xl:grid-cols-2">
      <div><h4 className="text-xs font-semibold">Posición por métrica · universo monitoreado</h4>
        <div className="mt-2 space-y-3">{ACTIVITY_METRICS.map(metric => {
          const available = networks.filter(n => n[metric.key] !== null);
          const value = network[metric.key];
          const position = value === null ? null : 1 + available.filter(n => n[metric.key]! > value).length;
          const component = network.activityComponents.find(c => c.key === metric.key)!;
          return <div key={metric.key}>
            <div className="flex justify-between gap-2 text-[11px]"><span className="text-ink-secondary">{metric.label}</span><span className="tabular-nums">{metricValue(value, metric.unit)} <span className="ml-2 text-ink-muted">{position ? `#${position}/${available.length}` : "Sin dato"}</span></span></div>
            <div className="mt-1 h-1.5 rounded bg-ice"><div className="h-full rounded bg-electric" style={{ width: `${(component.score ?? 0) * 10}%` }} /></div>
          </div>;
        })}</div>
        <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">Barras = nota normalizada, no cuota de mercado. Direcciones no son personas; DEX no es volumen de pagos.</p>
      </div>
      <div><h4 className="text-xs font-semibold">Aporte de cada categoría al BBI</h4>
        <table className="mt-2 w-full text-[11px]"><thead><tr className="text-ink-muted"><th className="pb-2 text-left font-normal">Categoría</th><th className="text-right font-normal">Nota</th><th className="text-right font-normal">Peso efectivo</th><th className="text-right font-normal">Puntos</th></tr></thead>
          <tbody>{network.contributions.map(c => <tr key={c.key} className="border-t border-line/60"><td className="py-1.5">{CATEGORY_LABELS[c.key]}</td><td className="text-right tabular-nums">{c.score?.toFixed(2) ?? "—"}</td><td className="text-right tabular-nums">{c.effectiveWeight.toFixed(1)}%</td><td className="text-right tabular-nums text-gold">{c.points.toFixed(2)}</td></tr>)}</tbody>
        </table><p className="mt-2 text-[10px] text-ink-muted">Suma de aportes sin redondear = {network.bbi.toFixed(2)}. Una categoría ausente redistribuye su peso y marca el resultado como parcial.</p>
      </div>
    </div>
    {network.referenceMetrics?.map(reference => <div key={reference.label} className="mt-4 rounded border border-line bg-card-raised p-3">
      <div className="flex flex-wrap justify-between gap-2"><h4 className="text-xs font-semibold">{reference.label} · {reference.period}</h4><b className="tabular-nums text-gold">{metricValue(reference.valueUsd)}</b></div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary">{reference.note}</p>
      <a href={reference.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] text-electric underline">{reference.source} · publicado {reference.publishedAt} ↗</a>
    </div>)}
    <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-secondary">{network.note}</p>
    <Evidence network={network} />
  </section>;
}
