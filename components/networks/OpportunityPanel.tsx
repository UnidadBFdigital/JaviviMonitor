"use client";

import { useState } from "react";
import { HeatGrid } from "@/components/charts/HeatGrid";
import { formatUsdCompact } from "@/lib/format";
import { PILLARS } from "@/lib/networks/score";
import { activeAddresses } from "@/lib/networks/series";
import { Info } from "./atoms";
import { Scatter, type ScatterPoint } from "./Scatter";
import { useIntel } from "./useNetworkIntel";

// Tres lecturas de patrón sobre el mismo universo: dónde el costo compra
// adopción, dónde el costo bajo coincide con desarrollo que acelera, y qué
// perfil tiene cada red por pilar.

function compact(value: number): string {
  if (value >= 1000) return new Intl.NumberFormat("es-BO", { notation: "compact" }).format(value);
  if (value >= 1) return value.toFixed(0);
  return value.toFixed(2);
}

export function CostScatter() {
  const { rows } = useIntel();
  const [axis, setAxis] = useState<"activity" | "tvl">("activity");

  const points: ScatterPoint[] = rows.map((r) => ({
    id: r.network.id,
    label: r.network.name,
    x: r.network.cost.medianUsd,
    y:
      axis === "activity"
        ? activeAddresses(r.network).value
        : r.network.liquidity.tvlUsd,
    size: r.network.liquidity.tvlUsd,
    layer: r.network.layer,
  }));

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash" aria-hidden />
          Costo contra {axis === "activity" ? "adopción" : "capital"}
          <Info text="Abajo a la derecha vive lo caro y poco usado; arriba a la izquierda, lo barato con demanda real." />
        </h3>
        <div className="flex gap-1">
          {(["activity", "tvl"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAxis(option)}
              className={`rounded border px-2 py-1 text-[10px] transition-colors ${
                axis === option
                  ? "border-electric bg-electric/10 text-ink"
                  : "border-line text-ink-secondary hover:text-ink"
              }`}
            >
              {option === "activity" ? "Direcciones activas" : "TVL"}
            </button>
          ))}
        </div>
      </div>

      <Scatter
        points={points}
        xLabel="Costo mediano por transacción (escala log)"
        yLabel={axis === "activity" ? "Direcciones activas 24h (log)" : "TVL (log)"}
        sizeLabel="TVL"
        formatX={(v) => (v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`)}
        formatY={(v) => (axis === "activity" ? compact(v) : formatUsdCompact(v))}
      />
    </section>
  );
}

export function OpportunityMap() {
  const { rows } = useIntel();

  const points: ScatterPoint[] = rows.map((r) => ({
    id: r.network.id,
    label: r.network.name,
    x: r.network.cost.medianUsd,
    // la variación de commits puede ser negativa: el eje va lineal
    y: r.network.dev.commitsChangePct,
    size: activeAddresses(r.network).value,
    layer: r.network.layer,
  }));

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="mb-1 flex items-baseline gap-2 text-sm font-semibold">
        <span className="bf-slash bf-slash-gold" aria-hidden />
        Mapa de oportunidad
        <Info text="Costo de operar contra aceleración del repositorio núcleo. El tamaño es la actividad de la red." />
      </h3>
      <p className="mb-3 max-w-3xl text-[11px] leading-relaxed text-ink-secondary">
        Los rótulos de cuadrante orientan la lectura; no son conclusiones. Una red barata con
        desarrollo acelerado puede seguir sin liquidez, y eso lo dice el ranking, no este gráfico.
      </p>

      <Scatter
        points={points}
        xLabel="Costo mediano por transacción (escala log) →"
        yLabel="Variación de commits, 12s vs 12s"
        sizeLabel="Direcciones activas"
        yLog={false}
        formatX={(v) => (v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`)}
        formatY={(v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}%`}
        quadrants={[
          "Barata · desarrollo acelerando",
          "Cara · desarrollo acelerando",
          "Barata · desarrollo frío",
          "Cara · desarrollo frío",
        ]}
      />
    </section>
  );
}

export function MetricsHeatmap() {
  const { rows } = useIntel();

  const cols = [...PILLARS.map((p) => p.short), "Índice"];
  const values = rows.map((r) => [
    ...PILLARS.map((pillar) => r.score.pillars.find((p) => p.id === pillar.id)?.score ?? null),
    r.score.score,
  ]);

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="mb-1 flex items-baseline gap-2 text-sm font-semibold">
        <span className="bf-slash bf-slash-gold" aria-hidden />
        Mapa de calor por pilar
        <Info text="Cada celda es el percentil normalizado del pilar dentro del universo filtrado, de 0 a 100." />
      </h3>
      <p className="mb-3 text-[11px] text-ink-secondary">
        Sirve para leer el perfil de una red de un vistazo: dónde es fuerte y dónde compensa.
        Gris = sin cobertura suficiente en ese pilar.
      </p>
      <HeatGrid
        rows={rows.map((r) => r.network.name)}
        cols={cols}
        values={values}
        min={0}
        max={100}
        formatValue={(v) => v.toFixed(0)}
      />
    </section>
  );
}
