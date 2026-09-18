"use client";

import { STATUS, colorAt, NEUTRAL } from "@/lib/palette";

// Treemap propio (squarify simplificado por filas) en SVG.
// Dos modos de color:
//  - "change": diverging verde/rojo por variación — el idioma financiero
//    estándar de un heatmap de mercado (polaridad alrededor de 0).
//  - "categorical": slots fijos por identidad, para distribuciones donde el
//    tamaño ya comunica la magnitud. Cada tile lleva etiqueta directa.

export type TreemapItem = {
  name: string;
  value: number;
  changePct?: number | null;
};

function changeFill(changePct: number | null | undefined): string {
  if (changePct === undefined || changePct === null) return "rgba(57,135,229,0.55)";
  const magnitude = Math.min(Math.abs(changePct) / 10, 1); // ±10% satura
  const alpha = 0.25 + magnitude * 0.55;
  const base = changePct >= 0 ? STATUS.up : STATUS.down;
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

type Rect = { x: number; y: number; w: number; h: number; item: TreemapItem; rank: number };

function layout(items: TreemapItem[], width: number, height: number): Rect[] {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];
  const rects: Rect[] = [];
  let y = 0;
  let index = 0;
  while (index < sorted.length) {
    const remainingTotal = sorted.slice(index).reduce((s, i) => s + i.value, 0);
    const remainingHeight = height - y;
    const row: { item: TreemapItem; rank: number }[] = [];
    let rowSum = 0;
    do {
      row.push({ item: sorted[index], rank: index });
      rowSum += sorted[index].value;
      index++;
    } while (index < sorted.length && rowSum < remainingTotal * 0.34 && row.length < 5);
    const rowHeight = Math.max((rowSum / remainingTotal) * remainingHeight, 24);
    let x = 0;
    for (const { item, rank } of row) {
      const w = (item.value / rowSum) * width;
      rects.push({ x, y, w, h: rowHeight, item, rank });
      x += w;
    }
    y += rowHeight;
    if (y >= height) break;
  }
  return rects;
}

export function TreemapChart({
  items,
  formatValue,
  mode = "change",
}: {
  items: TreemapItem[];
  formatValue: (v: number) => string;
  mode?: "change" | "categorical";
}) {
  const W = 800;
  const H = 420;
  const rects = layout(items, W, H);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img">
      {rects.map(({ x, y, w, h, item, rank }) => {
        const showLabel = w > 70 && h > 34;
        const fill = mode === "change" ? changeFill(item.changePct) : colorAt(rank);
        const solid = mode === "categorical" && fill !== NEUTRAL;
        return (
          <g key={item.name}>
            <rect
              x={x + 1}
              y={y + 1}
              width={Math.max(w - 2, 0)}
              height={Math.max(h - 2, 0)}
              rx="3"
              fill={fill}
              fillOpacity={solid ? 0.85 : 1}
              stroke="#14171b"
              strokeWidth="2"
            >
              <title>
                {item.name}: {formatValue(item.value)}
                {item.changePct !== undefined && item.changePct !== null
                  ? ` (${item.changePct > 0 ? "+" : ""}${item.changePct.toFixed(1)}%)`
                  : ""}
              </title>
            </rect>
            {showLabel && (
              <>
                <text x={x + 8} y={y + 18} fontSize="12" fontWeight="600" fill="#ffffff">
                  {item.name.length > w / 8 ? item.name.slice(0, Math.floor(w / 8)) + "…" : item.name}
                </text>
                <text x={x + 8} y={y + 33} fontSize="10" fill="#e8edf2" fillOpacity="0.8">
                  {formatValue(item.value)}
                  {item.changePct !== undefined && item.changePct !== null
                    ? `  ${item.changePct > 0 ? "+" : ""}${item.changePct.toFixed(1)}%`
                    : ""}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
