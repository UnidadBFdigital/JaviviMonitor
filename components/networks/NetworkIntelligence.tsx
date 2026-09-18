"use client";

import { useState } from "react";
import { ComparatorPanel } from "./ComparatorPanel";
import { CostExplorer } from "./CostExplorer";
import { BuildStackPanel, DeveloperPanel } from "./DeveloperPanel";
import { MethodologyPanel } from "./MethodologyPanel";
import { NetworkProfile } from "./NetworkProfile";
import { OverviewStrip } from "./OverviewStrip";
import { NetworkRanking } from "./NetworkRanking";
import { TrendsPanel } from "./TrendsPanel";
import { UseCasePanel } from "./UseCasePanel";
import { IntelProvider, useIntel, useNetworkIntelState, type LayerFilter, type VmFilter } from "./useNetworkIntel";

// Builder Radar: la página se lee de arriba abajo como una decisión, no como
// un tablero. Primero quién lidera, después qué red conviene para lo que vas
// a construir, el ranking completo y recién ahí el detalle de costo,
// tendencia, desarrollo y comparación. La metodología cierra, plegada.
//
// Las vistas de dispersión, momentum, señales, mapa de calor y RWA de la
// versión anterior siguen en la carpeta: salieron de la página porque
// repetían lecturas y dependían de series que solo cubren a Ethereum y sus L2.

const LAYERS: { id: LayerFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "L1", label: "L1" },
  { id: "L2", label: "L2" },
];

const VMS: { id: VmFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "evm", label: "EVM" },
  { id: "nonevm", label: "No-EVM" },
];

const STEPS: { href: string; label: string }[] = [
  { href: "#para-que", label: "Qué vas a construir" },
  { href: "#ranking", label: "Ranking" },
  { href: "#costo", label: "Costo" },
  { href: "#tendencia", label: "Tendencia" },
  { href: "#desarrollo", label: "Desarrollo" },
  { href: "#comparar", label: "Comparar" },
  { href: "#metodologia", label: "Metodología" },
];

function FilterGroup<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted" title={hint}>
        {label}
      </span>
      <div className="flex">
        {options.map((option, i) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            className={`border px-2 py-1 text-[11px] transition-colors ${i > 0 ? "-ml-px" : ""} ${
              value === option.id
                ? "border-electric bg-electric/10 text-ink"
                : "border-line text-ink-secondary hover:border-electric/60 hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toolbar() {
  const { layer, setLayer, vm, setVm, rows, payload } = useIntel();

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-card px-3 py-2">
      <FilterGroup label="Capa" options={LAYERS} value={layer} onChange={setLayer} hint="Comparar dentro de la misma clase antes que entre clases." />
      <FilterGroup label="Máquina virtual" options={VMS} value={vm} onChange={setVm} hint="EVM incluye zkEVM: mide si un contrato de Ethereum se porta sin reescribirse." />
      <nav aria-label="Secciones" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        {STEPS.map((step, index) => (
          <a key={step.href} href={step.href} className="text-ink-secondary transition-colors hover:text-electric">
            <span className="mr-1 font-mono text-[10px] text-ink-muted">{index + 1}</span>
            {step.label}
          </a>
        ))}
      </nav>
      <p className="ml-auto text-[11px] text-ink-secondary">
        {rows.length} redes
        {payload && payload.failed.length > 0 && (
          <span className="ml-2 text-warn">· sin respuesta: {payload.failed.join(", ")}</span>
        )}
      </p>
    </div>
  );
}

function Body() {
  const { loading, error, rows } = useIntel();
  const [open, setOpen] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="bf-shimmer h-20 rounded-lg" />
        <div className="bf-shimmer h-72 rounded-lg" />
        <div className="bf-shimmer h-64 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-line bg-card p-6 text-center">
        <p className="text-sm text-ink">No se pudo cargar el universo de redes.</p>
        <p className="mt-1 text-xs text-ink-muted">
          Ninguna de las fuentes respondió. El módulo no inventa valores: reintentá en unos minutos.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-card p-6 text-center text-sm text-ink-muted">
        Ninguna red cumple los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OverviewStrip />
      <div id="para-que" className="scroll-mt-4">
        <UseCasePanel onOpen={setOpen} />
      </div>
      <div id="ranking" className="scroll-mt-4">
        <NetworkRanking onOpen={setOpen} />
      </div>
      <div id="costo" className="scroll-mt-4">
        <CostExplorer />
      </div>
      <div id="tendencia" className="scroll-mt-4">
        <TrendsPanel />
      </div>
      <div id="desarrollo" className="scroll-mt-4 space-y-4">
        <DeveloperPanel />
        <BuildStackPanel />
      </div>
      <div id="comparar" className="scroll-mt-4">
        <ComparatorPanel />
      </div>
      <MethodologyPanel />

      <NetworkProfile id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

export function NetworkIntelligence() {
  const intel = useNetworkIntelState();

  return (
    <IntelProvider value={intel}>
      <div className="space-y-4">
        <Toolbar />
        <Body />
      </div>
    </IntelProvider>
  );
}
