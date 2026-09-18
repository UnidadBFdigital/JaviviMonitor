"use client";

import { useState } from "react";
import { GOLD, CATEGORICAL, CHART_THEME } from "@/lib/palette";

// Matriz de oportunidad — visualización distintiva de Blockfinity.
// Genérica a propósito: sirve para la cartera boliviana de hoy y para
// cualquier estudio sectorial futuro sin tocar el componente.
//
//   X  viabilidad de implementación →
//   Y  oportunidad de mercado ↑
//   r  tercera dimensión (madurez de la infraestructura)
//
// Los cuadrantes llevan nombre de acción, no de categoría: la matriz existe
// para decidir por dónde empezar, no para clasificar.

export type MatrixPoint = {
  name: string;
  /** viabilidad 0-10 */
  x: number;
  /** oportunidad 0-10 */
  y: number;
  /** tercera dimensión 0-10 → radio */
  z: number;
  note?: string;
};

const W = 720;
const H = 480;
// El radio máximo es 29px y las etiquetas de cuadrante viven arriba: sin
// este margen, un punto con potencial 10 queda cortado contra el borde.
const PAD = { top: 52, right: 34, bottom: 52, left: 56 };

const QUADRANTS = [
  { label: "Ejecutar ahora", sub: "alto potencial · ejecutable", qx: 1, qy: 1, tone: GOLD },
  { label: "Preparar terreno", sub: "vale la pena, falta base", qx: 0, qy: 1, tone: CHART_THEME.axis },
  { label: "Ganancia rápida", sub: "fácil pero acotado", qx: 1, qy: 0, tone: CHART_THEME.axis },
  { label: "Observar", sub: "sin caso hoy", qx: 0, qy: 0, tone: CHART_THEME.axis },
];

export function OpportunityMatrix({
  points,
  xLabel = "Viabilidad de implementación",
  yLabel = "Oportunidad de mercado",
  zLabel = "Madurez de la infraestructura",
}: {
  points: MatrixPoint[];
  xLabel?: string;
  yLabel?: string;
  zLabel?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const sx = (v: number) => PAD.left + (v / 10) * plotW;
  const sy = (v: number) => PAD.top + (1 - v / 10) * plotH;
  const sr = (v: number) => 9 + (v / 10) * 20;

  const midX = sx(5);
  const midY = sy(5);

  // las burbujas grandes se dibujan primero para que las chicas no queden tapadas
  const ordered = [...points].sort((a, b) => b.z - a.z);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto h-auto w-full"
        style={{ maxHeight: 460 }}
        role="img"
      >
        <title>{`${yLabel} contra ${xLabel}; el tamaño representa ${zLabel.toLowerCase()}`}</title>

        {/* cuadrante de acción resaltado en dorado */}
        <rect
          x={midX}
          y={PAD.top}
          width={W - PAD.right - midX}
          height={midY - PAD.top}
          fill={GOLD}
          opacity={0.045}
        />

        {/* retícula */}
        {[0, 2.5, 5, 7.5, 10].map((v) => (
          <g key={`g${v}`}>
            <line
              x1={sx(v)}
              y1={PAD.top}
              x2={sx(v)}
              y2={H - PAD.bottom}
              stroke={CHART_THEME.grid}
              strokeWidth={v === 5 ? 1.5 : 1}
              strokeDasharray={v === 5 ? undefined : "2 4"}
            />
            <line
              x1={PAD.left}
              y1={sy(v)}
              x2={W - PAD.right}
              y2={sy(v)}
              stroke={CHART_THEME.grid}
              strokeWidth={v === 5 ? 1.5 : 1}
              strokeDasharray={v === 5 ? undefined : "2 4"}
            />
          </g>
        ))}

        {/* etiquetas de cuadrante */}
        {QUADRANTS.map((q) => {
          const x = q.qx === 1 ? W - PAD.right - 8 : PAD.left + 8;
          const y = q.qy === 1 ? PAD.top - 26 : H - PAD.bottom - 18;
          const anchor = q.qx === 1 ? "end" : "start";
          return (
            <g key={q.label}>
              <text x={x} y={y} textAnchor={anchor} fill={q.tone} fontSize={11} fontWeight={600}>
                {q.label}
              </text>
              <text
                x={x}
                y={y + 13}
                textAnchor={anchor}
                fill={CHART_THEME.axis}
                fontSize={9.5}
              >
                {q.sub}
              </text>
            </g>
          );
        })}

        {/* ejes */}
        <text
          x={PAD.left + plotW / 2}
          y={H - 10}
          textAnchor="middle"
          fill={CHART_THEME.axis}
          fontSize={11}
        >
          {xLabel} →
        </text>
        <text
          transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}
          x={14}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          fill={CHART_THEME.axis}
          fontSize={11}
        >
          {yLabel} ↑
        </text>
        {[0, 5, 10].map((v) => (
          <g key={`t${v}`}>
            <text
              x={sx(v)}
              y={H - PAD.bottom + 15}
              textAnchor="middle"
              fill={CHART_THEME.axis}
              fontSize={9.5}
            >
              {v}
            </text>
            <text
              x={PAD.left - 9}
              y={sy(v) + 3}
              textAnchor="end"
              fill={CHART_THEME.axis}
              fontSize={9.5}
            >
              {v}
            </text>
          </g>
        ))}

        {/* burbujas */}
        {ordered.map((p, i) => {
          const cx = sx(p.x);
          const cy = sy(p.y);
          const r = sr(p.z);
          const prioritario = p.x >= 5 && p.y >= 5;
          const color = prioritario ? GOLD : CATEGORICAL[i % 3];
          const on = hover === p.name;
          return (
            <g
              key={p.name}
              onMouseEnter={() => setHover(p.name)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "default" }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                fillOpacity={on ? 0.42 : 0.24}
                stroke={color}
                strokeWidth={on ? 2.5 : 2}
                className="bf-grow-y"
                style={{ "--bf-i": i, transformOrigin: `${cx}px ${cy}px` } as React.CSSProperties}
              />
              {/* etiqueta directa: con pocos puntos siempre es mejor que una leyenda */}
              <text
                x={cx}
                y={cy + r + 13}
                textAnchor="middle"
                fill={on ? CHART_THEME.ink : "#9fb0be"}
                fontSize={11}
                fontWeight={on ? 600 : 500}
              >
                {p.name}
              </text>
              {on && p.note && (
                <text
                  x={cx}
                  y={cy + r + 26}
                  textAnchor="middle"
                  fill={CHART_THEME.axis}
                  fontSize={9.5}
                >
                  {p.note}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p className="mt-2 text-[11px] text-ink-muted">
        Eje X {xLabel.toLowerCase()} · eje Y {yLabel.toLowerCase()} · tamaño{" "}
        {zLabel.toLowerCase()}. El cuadrante dorado es el único que se ejecuta este año.
      </p>
    </div>
  );
}
