"use client";

import { useState } from "react";
import { SourceBadge } from "@/components/SourceBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { chainKey } from "@/lib/bbiMethodology";
import type { Network } from "@/lib/bbi";
import type { ChainActivityMetric } from "@/lib/sources/defillamaDashboard";
import type { SourceResult } from "@/lib/sources/types";
import { metricValue } from "./NetworkAnalysis";

const METRICS = [
  { key: "activeAddresses24h", label: "Direcciones · 24h", unit: "count" },
  { key: "stablecoinMcapUsd", label: "Stablecoins", unit: "usd" },
  { key: "tvlUsd", label: "TVL DeFi", unit: "usd" },
  { key: "dexVolume24hUsd", label: "DEX · 24h", unit: "usd" },
  { key: "dexVolume7dUsd", label: "DEX · 7 días", unit: "usd" },
  { key: "chainFees24hUsd", label: "Fees red · 24h", unit: "usd" },
  { key: "chainFees7dUsd", label: "Fees red · 7 días", unit: "usd" },
] as const;
const columns: Column<ChainActivityMetric>[] = [
  { key: "name", header: "Red", value: n => n.name, required: true },
  ...METRICS.map(m => ({ key: m.key, header: m.label, numeric: true, value: (n: ChainActivityMetric) => n[m.key], render: (n: ChainActivityMetric) => metricValue(n[m.key], m.unit) })),
  { key: "protocols", header: "Protocolos", numeric: true, value: n => n.protocolCount },
];

export function ChainActivityView({ result, networks }: { result: SourceResult<ChainActivityMetric[]>; networks: Network[] }) {
  const [selected, setSelected] = useState<(typeof METRICS)[number]["key"]>("activeAddresses24h");
  const [all, setAll] = useState(false);
  if (!result.ok) return <section className="rounded-lg border border-line bg-card p-4"><h3 className="text-sm font-semibold">Actividad por blockchain</h3><p className="mt-3 text-sm text-ink-muted">La fuente de actividad no respondió. El resto de indicadores conserva su cobertura individual.</p></section>;
  const metric = METRICS.find(m => m.key === selected)!;
  const names = new Map(networks.filter(n => n.llamaName).map(n => [chainKey(n.llamaName!), n.name]));
  const rows = result.data.filter(n => all || names.has(chainKey(n.name))).map(n => ({ ...n, name: names.get(chainKey(n.name)) ?? n.name }));
  // el nombre mostrado viene del universo curado; el histórico se pide con el de DeFiLlama
  const llamaOf = new Map(result.data.map(n => [names.get(chainKey(n.name)) ?? n.name, n.name]));
  const ranked = rows.filter(n => n[selected] !== null).sort((a, b) => b[selected]! - a[selected]!);
  const max = ranked[0]?.[selected] ?? 0;
  return <section className="rounded-lg border border-line bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Dónde ocurre la actividad</h3><p className="mt-1 text-xs text-ink-secondary">Orden independiente por uso, capital y volumen. {ranked.length}/{rows.length} redes con dato para {metric.label.toLowerCase()}.</p></div>
      <label className="flex items-center gap-2 text-xs text-ink-secondary"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />Todas las redes de la fuente</label>
    </div>
    <div role="group" aria-label="Métrica de actividad" className="mt-4 flex flex-wrap gap-2">{METRICS.map(m => <button key={m.key} onClick={() => setSelected(m.key)} aria-pressed={selected === m.key} className={`rounded border px-2.5 py-1.5 text-[11px] ${selected === m.key ? "border-electric bg-electric/15 text-ink" : "border-line text-ink-secondary hover:bg-ice"}`}>{m.label}</button>)}</div>
    <div className="my-4 grid gap-x-8 gap-y-3 md:grid-cols-2">{ranked.slice(0, 10).map((row, i) => <div key={row.name}>
      <div className="flex justify-between gap-3 text-xs"><span><span className="mr-2 text-[10px] text-ink-muted">{i + 1}</span>{row.name}</span><b className="tabular-nums">{metricValue(row[selected], metric.unit)}</b></div>
      <div className="mt-1.5 h-1.5 rounded bg-ice"><div className="h-full rounded bg-electric" style={{ width: `${max > 0 ? row[selected]! / max * 100 : 0}%` }} /></div>
    </div>)}</div>
    {!ranked.length && <p className="py-4 text-sm text-ink-muted">Sin datos para esta métrica en el universo elegido.</p>}
    <DataTable key={`${selected}-${all}`} rows={rows} columns={columns} initialSort={{ key: selected, dir: "desc" }} exportName={`blockchain-actividad-${selected}`} rowHistory={n => { const chain = llamaOf.get(n.name); return chain ? { kind: "chain-tvl", id: chain, label: n.name } : null; }} />
    <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-muted">Direcciones activas ≠ personas únicas: pueden incluir bots y no se suman entre redes para estimar usuarios. DEX mide intercambios, no pagos ni transferencias de stablecoins. TVL y oferta son stocks; DEX y fees son flujos. Los totales de 7 días no son promedios diarios. Las barras comparan con el líder de la métrica.</p>
    <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
  </section>;
}
