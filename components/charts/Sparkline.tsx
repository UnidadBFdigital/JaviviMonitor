"use client";

import { useId } from "react";
import { CATEGORICAL, STATUS } from "@/lib/palette";

// Sparkline en SVG puro — para KPI y filas de tabla.
// Especificación de marca: línea de 2px con extremos redondeados, punto final
// de 3px para anclar la lectura en el último valor, y relleno degradado que
// da cuerpo sin competir con la línea. El trazo se dibuja al entrar.

export function Sparkline({
  values,
  width = 96,
  height = 28,
  positive,
  area = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  /** pinta según dirección; undefined = azul categórico neutro */
  positive?: boolean;
  area?: boolean;
}) {
  const gradId = useId();
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const step = (width - pad * 2) / (values.length - 1);

  const pts = values.map((v, i) => ({
    x: pad + i * step,
    y: pad + (height - pad * 2) * (1 - (v - min) / range),
  }));

  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];

  // longitud aproximada del trazo, para que la animación recorra su medida real
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }

  const color = positive === undefined ? CATEGORICAL[0] : positive ? STATUS.up : STATUS.down;

  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible" aria-hidden>
      {area && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon
            points={`${pad},${height - pad} ${line} ${(width - pad).toFixed(1)},${height - pad}`}
            fill={`url(#${gradId})`}
          />
        </>
      )}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="bf-draw"
        style={{ "--bf-len": len.toFixed(0) } as React.CSSProperties}
      />
      <circle cx={last.x} cy={last.y} r="3" fill={color} stroke="#14171b" strokeWidth="1.5" />
    </svg>
  );
}
