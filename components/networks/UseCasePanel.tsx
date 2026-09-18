"use client";

import { COMPONENTS, INDEX_NAME, PILLARS, PROFILES, PROFILE_BY_ID, type ComponentId } from "@/lib/networks/score";
import { Info, ScoreBar, formatCost, formatCount, formatPctValue, formatUsd } from "./atoms";
import { useIntel } from "./useNetworkIntel";

// "No existe una blockchain mejor": existe la mejor para lo que vas a
// construir. El selector cambia los pesos del índice y el podio se recalcula
// en el acto. El "por qué" no es texto libre: son los tres componentes que más
// aportan al puntaje, con su cifra real al lado.

function rawLabel(id: ComponentId, raw: number | null): string {
  if (raw === null) return "—";
  switch (id) {
    case "feesPerUser":
    case "cost":
      return `${formatCost(raw)} por usuario`;
    case "tvl":
    case "stablecoins":
    case "dexVolume":
    case "rwaTvl":
      return formatUsd(raw);
    case "tooling":
    case "evmCompat":
    case "security":
      return `${raw.toFixed(1)}/10`;
    case "devMomentum":
      return formatPctValue(raw);
    default:
      return formatCount(raw);
  }
}

export function UseCasePanel({ onOpen }: { onOpen: (id: string) => void }) {
  const { rows, profile, setProfile } = useIntel();
  const current = PROFILE_BY_ID.get(profile)!;
  const podium = rows.filter((r) => r.score.score !== null).slice(0, 3);

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash bf-slash-gold" aria-hidden />
          ¿Qué vas a construir?
          <Info text={`Cada caso de uso redefine los pesos de los cinco pilares del ${INDEX_NAME}. Los pesos están publicados en la metodología.`} />
        </h3>
        <p className="mt-0.5 max-w-3xl text-[11px] leading-relaxed text-ink-secondary">{current.question}</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {PROFILES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setProfile(option.id)}
            aria-pressed={profile === option.id}
            className={`rounded border px-2.5 py-1 text-[11px] transition-colors ${
              profile === option.id
                ? "border-gold bg-gold/10 text-gold-bright"
                : "border-line text-ink-secondary hover:border-gold/50 hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {podium.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-muted">Ninguna red del filtro actual tiene datos suficientes para puntuar.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {podium.map((row, index) => (
            <article
              key={row.network.id}
              className={`border p-3 ${index === 0 ? "bf-premium border-charcoal-line" : "border-line bg-card-raised"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="flex items-baseline gap-2">
                  <span className={`font-mono text-[10px] ${index === 0 ? "text-gold" : "text-ink-muted"}`}>{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => onOpen(row.network.id)}
                    className="text-[13px] font-semibold transition-colors hover:text-electric"
                  >
                    {row.network.name}
                  </button>
                </p>
                <p className={`text-lg font-semibold tabular-nums ${index === 0 ? "text-gold-bright" : "text-ink"}`}>
                  {row.score.score!.toFixed(0)}
                  <span className="text-[10px] font-normal text-ink-muted">/100</span>
                </p>
              </div>

              <p className="mb-1 mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Por qué</p>
              <ul className="space-y-0.5">
                {row.score.drivers.map((driver) => (
                  <li key={driver.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate text-ink-secondary">{driver.label}</span>
                    <span className="shrink-0 tabular-nums">{rawLabel(driver.id, driver.raw)}</span>
                  </li>
                ))}
              </ul>

              {row.score.drag && (
                <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
                  Punto débil: {row.score.drag.label.toLowerCase()} ({rawLabel(row.score.drag.id, row.score.drag.raw)}).
                </p>
              )}

              <div className="mt-2 space-y-1 border-t border-line/70 pt-2">
                {row.score.pillars.map((pillar) => (
                  <div key={pillar.id} className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate text-ink-muted">
                      {pillar.label} · {current.pillars[pillar.id]}%
                    </span>
                    <ScoreBar value={pillar.score} gold={index === 0} reason="Sin datos suficientes para este pilar." />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        Pesos: {PILLARS.map((pillar) => `${pillar.short.toLowerCase()} ${current.pillars[pillar.id]}%`).join(" · ")}
        {Object.keys(current.emphasis).length > 0 &&
          ` · refuerza ${Object.entries(current.emphasis)
            .map(([id, factor]) => `${(COMPONENTS.find((c) => c.id === id)?.label ?? id).toLowerCase()} ×${factor}`)
            .join(", ")}`}
        . La recomendación sale de esos pesos aplicados a datos observados, no de una opinión.
      </p>
    </section>
  );
}
