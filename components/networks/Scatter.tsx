"use client";

import { useState } from "react";
import { CATEGORICAL, CHART_THEME, GOLD, NEUTRAL } from "@/lib/palette";

// Dispersión con ejes logarítmicos opcionales y tercera dimensión en el radio.
// Se usa dos veces con configuraciones distintas (costo × actividad y el mapa
// de oportunidad) en vez de duplicar dos gráficos casi iguales.

export type ScatterPoint = {
  id: string;
  label: string;
  x: number | null;
  y: number | null;
  size: number | null;
  layer: string;
  note?: string;
};

const W = 720;
const H = 420;
const PAD = { top: 34, right: 26, bottom: 46, left: 62 };

function scaleFactory(values: number[], log: boolean, from: number, to: number) {
  const clean = values.filter((v) => Number.isFinite(v) && (!log || v > 0));
  const min = clean.length > 0 ? Math.min(...clean) : 0;
  const max = clean.length > 0 ? Math.max(...clean) : 1;
  const t = (v: number) => (log ? Math.log10(Math.max(v, min > 0 ? min : 1e-9)) : v);
  const lo = t(min);
  const hi = t(max);
  const span = hi - lo || 1;
  // 8% de aire a cada lado para que ningún punto quede pegado al borde
  const pad = span * 0.08;
  return {
    map: (v: number) => from + ((t(v) - (lo - pad)) / (span + pad * 2)) * (to - from),
    ticks: [lo - pad, lo + span / 2, hi + pad].map((tv) => (log ? 10 ** tv : tv)),
    min,
    max,
  };
}

export function Scatter({
  points,
  xLabel,
  yLabel,
  sizeLabel,
  xLog = true,
  yLog = true,
  formatX,
  formatY,
  quadrants,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  sizeLabel: string;
  xLog?: boolean;
  yLog?: boolean;
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  /** etiquetas de cuadrante en el orden: arriba-izq, arriba-der, abajo-izq, abajo-der */
  quadrants?: [string, string, string, string];
}) {
  const [hover, setHover] = useState<string | null>(null);

  const usable = points.filter(
    (p) => p.x !== null && p.y !== null && (!xLog || p.x > 0) && (!yLog || p.y > 0)
  ) as (ScatterPoint & { x: number; y: number })[];

  if (usable.length < 2) {
    return (
      <p className="flex h-48 items-center justify-center text-xs text-ink-muted">
        Sin suficientes redes con ambos datos para dibujar la dispersión.
      </p>
    );
  }

  const sx = scaleFactory(usable.map((p) => p.x), xLog, PAD.left, W - PAD.right);
  const sy = scaleFactory(usable.map((p) => p.y), yLog, H - PAD.bottom, PAD.top);
  const sizes = usable.map((p) => p.size ?? 0).filter((v) => v > 0);
  const maxSize = sizes.length > 0 ? Math.max(...sizes) : 1;
  const radius = (v: number | null) => (v === null || v <= 0 ? 5 : 5 + Math.sqrt(v / maxSize) * 16);

  const midX = (PAD.left + (W - PAD.right)) / 2;
  const midY = (PAD.top + (H - PAD.bottom)) / 2;
  const ordered = [...usable].sort((a, b) => (b.size ?? 0) - (a.size ?? 0));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${yLabel} contra ${xLabel}`}>
        {quadrants && (
          <>
            <rect x={PAD.left} y={PAD.top} width={midX - PAD.left} height={midY - PAD.top} fill={GOLD} opacity={0.05} />
            <line x1={midX} y1={PAD.top} x2={midX} y2={H - PAD.bottom} stroke={CHART_THEME.grid} strokeWidth={1.5} />
            <line x1={PAD.left} y1={midY} x2={W - PAD.right} y2={midY} stroke={CHART_THEME.grid} strokeWidth={1.5} />
            {([
              { text: quadrants[0], x: PAD.left + 8, y: PAD.top + 14, anchor: "start", tone: GOLD },
              { text: quadrants[1], x: W - PAD.right - 8, y: PAD.top + 14, anchor: "end", tone: CHART_THEME.axis },
              { text: quadrants[2], x: PAD.left + 8, y: H - PAD.bottom - 8, anchor: "start", tone: CHART_THEME.axis },
              { text: quadrants[3], x: W - PAD.right - 8, y: H - PAD.bottom - 8, anchor: "end", tone: CHART_THEME.axis },
            ] as const).map((q) => (
              <text key={q.text} x={q.x} y={q.y} textAnchor={q.anchor} fontSize={10} fontWeight={600} fill={q.tone}>
                {q.text}
              </text>
            ))}
          </>
        )}

        {/* ejes */}
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke={CHART_THEME.grid} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke={CHART_THEME.grid} />

        {sx.ticks.map((tick, i) => (
          <text key={`x${i}`} x={sx.map(tick)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={9} fill={CHART_THEME.axis}>
            {formatX(tick)}
          </text>
        ))}
        {sy.ticks.map((tick, i) => (
          <text key={`y${i}`} x={PAD.left - 6} y={sy.map(tick) + 3} textAnchor="end" fontSize={9} fill={CHART_THEME.axis}>
            {formatY(tick)}
          </text>
        ))}

        <text x={(PAD.left + W - PAD.right) / 2} y={H - 8} textAnchor="middle" fontSize={10} fill={CHART_THEME.axis}>
          {xLabel}
        </text>
        <text
          x={-(PAD.top + H - PAD.bottom) / 2}
          y={13}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize={10}
          fill={CHART_THEME.axis}
        >
          {yLabel}
        </text>

        {ordered.map((point, i) => {
          const cx = sx.map(point.x);
          const cy = sy.map(point.y);
          const on = hover === point.id;
          const color = point.layer === "L2" ? CATEGORICAL[0] : CATEGORICAL[1];
          return (
            <g
              key={point.id}
              onMouseEnter={() => setHover(point.id)}
              onMouseLeave={() => setHover(null)}
              className="cursor-default"
            >
              <circle
                cx={cx}
                cy={cy}
                r={radius(point.size)}
                fill={color}
                fillOpacity={on ? 0.4 : 0.22}
                stroke={on ? "#e8edf2" : color}
                strokeWidth={on ? 1.6 : 1.2}
                style={{ transition: "fill-opacity 150ms" }}
              />
              <text
                x={cx}
                y={cy - radius(point.size) - 4}
                textAnchor="middle"
                fontSize={9.5}
                fill={on ? "#e8edf2" : "#9fb0be"}
                style={{ pointerEvents: "none" }}
              >
                {point.label}
              </text>
              {on && (
                <text x={cx} y={cy + radius(point.size) + 12} textAnchor="middle" fontSize={9} fill={NEUTRAL}>
                  {formatX(point.x)} · {formatY(point.y)}
                </text>
              )}
              {i === 0 && null}
            </g>
          );
        })}
      </svg>

      <p className="mt-1 text-[10px] text-ink-muted">
        Tamaño de burbuja: {sizeLabel.toLowerCase()} · azul L2, naranja L1. Las redes sin uno de los
        dos datos no se dibujan.
      </p>
    </div>
  );
}
