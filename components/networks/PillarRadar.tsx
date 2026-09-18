"use client";

import { CATEGORICAL, CHART_THEME } from "@/lib/palette";
import { PILLARS, type ScoredNetworkResult } from "@/lib/networks/score";

// Radar de los cinco pilares. Acá sí funciona: cinco ejes, escala común 0-100
// y como mucho cinco redes. La forma del polígono es la lectura —una red
// puntiaguda es especialista, una redonda es equilibrada— y eso una tabla de
// cinco filas no lo muestra.

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 44;

export function PillarRadar({
  entries,
}: {
  entries: { id: string; name: string; score: ScoredNetworkResult | undefined }[];
}) {
  const axes = PILLARS.map((pillar, i) => {
    // arranca arriba y gira en sentido horario
    const angle = (Math.PI * 2 * i) / PILLARS.length - Math.PI / 2;
    return {
      ...pillar,
      angle,
      x: CENTER + Math.cos(angle) * RADIUS,
      y: CENTER + Math.sin(angle) * RADIUS,
      labelX: CENTER + Math.cos(angle) * (RADIUS + 22),
      labelY: CENTER + Math.sin(angle) * (RADIUS + 22),
    };
  });

  const point = (index: number, value: number) => {
    const axis = axes[index];
    const r = (Math.max(0, Math.min(100, value)) / 100) * RADIUS;
    return `${(CENTER + Math.cos(axis.angle) * r).toFixed(1)},${(CENTER + Math.sin(axis.angle) * r).toFixed(1)}`;
  };

  const usable = entries.filter((entry) => entry.score);

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {/* el viewBox lleva margen propio: los rótulos de los ejes viven fuera
          del pentágono y sin ese aire quedaban cortados contra el borde */}
      <svg
        viewBox={`-42 -14 ${SIZE + 84} ${SIZE + 34}`}
        className="h-auto w-full max-w-[360px]"
        role="img"
        aria-label="Perfil por pilar"
      >
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={axes.map((_, i) => point(i, ring)).join(" ")}
            fill="none"
            stroke={CHART_THEME.grid}
            strokeWidth={ring === 100 ? 1.2 : 1}
          />
        ))}

        {axes.map((axis) => (
          <line key={axis.id} x1={CENTER} y1={CENTER} x2={axis.x} y2={axis.y} stroke={CHART_THEME.grid} strokeWidth={1} />
        ))}

        {usable.map((entry, index) => {
          const color = CATEGORICAL[index % CATEGORICAL.length];
          // un pilar sin cobertura no se dibuja como cero: se cierra el
          // polígono con el valor del pilar anterior disponible
          const values = PILLARS.map(
            (pillar) => entry.score!.pillars.find((p) => p.id === pillar.id)?.score ?? null
          );
          const covered = values.filter((v) => v !== null) as number[];
          if (covered.length < 3) return null;
          const filled = values.map((v) => v ?? covered.reduce((a, b) => a + b, 0) / covered.length);
          return (
            <polygon
              key={entry.id}
              points={filled.map((value, i) => point(i, value)).join(" ")}
              fill={color}
              fillOpacity={0.14}
              stroke={color}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          );
        })}

        {axes.map((axis) => (
          <text
            key={`label-${axis.id}`}
            x={axis.labelX}
            y={axis.labelY}
            textAnchor={axis.labelX > CENTER + 6 ? "start" : axis.labelX < CENTER - 6 ? "end" : "middle"}
            dominantBaseline="middle"
            fontSize={9.5}
            fill={CHART_THEME.axis}
          >
            {axis.short}
          </text>
        ))}
      </svg>

      <ul className="space-y-1">
        {usable.map((entry, index) => (
          <li key={entry.id} className="flex items-center gap-2 text-[11px]">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: CATEGORICAL[index % CATEGORICAL.length] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-ink-secondary">{entry.name}</span>
            <span className="shrink-0 tabular-nums text-ink">
              {entry.score?.score === null || entry.score === undefined ? "—" : entry.score.score.toFixed(0)}
            </span>
          </li>
        ))}
        <li className="pt-1 text-[10px] leading-relaxed text-ink-muted">
          Escala 0-100 por pilar. Un pilar sin cobertura se dibuja con el promedio de los demás,
          nunca como cero.
        </li>
      </ul>
    </div>
  );
}
