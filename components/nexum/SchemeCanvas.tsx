"use client";

import { useState } from "react";
import { CATEGORICAL, NEUTRAL } from "@/lib/palette";
import type { NexumNodeKind, NexumScheme } from "@/lib/nexum";
import { usePrefersReducedMotion } from "./useNexum";

// Esquema de proceso animado. Los nodos entran en cadena, las aristas se
// dibujan y una partícula recorre cada una: el movimiento es la explicación
// —muestra la dirección del flujo sin una leyenda que la describa—. Con
// prefers-reduced-motion queda el mismo diagrama, quieto.
//
// El layout es una grilla col/row declarada en el currículo, no un motor de
// grafos: los esquemas son de seis u ocho nodos y colocarlos a mano da un
// resultado más legible que cualquier algoritmo.

const KIND_COLOR: Record<NexumNodeKind, string> = {
  input: CATEGORICAL[0],
  process: NEUTRAL,
  chain: "#2f66ff",
  output: CATEGORICAL[2],
};

const COL_W = 212;
const ROW_H = 84;
const BOX_W = 150;
const BOX_H = 54;
const PAD = 14;

export function SchemeCanvas({ scheme }: { scheme: NexumScheme }) {
  const reduced = usePrefersReducedMotion();
  const [focus, setFocus] = useState<string | null>(null);

  const cols = Math.max(...scheme.nodes.map((n) => n.col)) + 1;
  const rows = Math.max(...scheme.nodes.map((n) => n.row)) + 1;
  const W = cols * COL_W + PAD * 2;
  const H = rows * ROW_H + PAD * 2;

  const pos = new Map(
    scheme.nodes.map((node) => [
      node.id,
      { x: PAD + node.col * COL_W, y: PAD + node.row * ROW_H },
    ])
  );

  /** Recto si comparten fila; codo de tres tramos si cambian de fila. */
  function pathFor(fromId: string, toId: string): string | null {
    const a = pos.get(fromId);
    const b = pos.get(toId);
    if (!a || !b) return null;
    const x0 = a.x + BOX_W;
    const y0 = a.y + BOX_H / 2;
    const x1 = b.x;
    const y1 = b.y + BOX_H / 2;
    if (Math.abs(y0 - y1) < 1) return `M ${x0} ${y0} L ${x1 - 7} ${y1}`;
    if (x1 <= x0) {
      // arista de retorno (una defensa que corta el flujo aguas arriba)
      const midY = Math.max(y0, y1) + BOX_H / 2 + 6;
      return `M ${a.x + BOX_W / 2} ${a.y} L ${a.x + BOX_W / 2} ${midY} L ${b.x + BOX_W / 2} ${midY} L ${b.x + BOX_W / 2} ${b.y + BOX_H + 7}`;
    }
    const midX = (x0 + x1) / 2;
    return `M ${x0} ${y0} L ${midX} ${y0} L ${midX} ${y1} L ${x1 - 7} ${y1}`;
  }

  const dimmed = (id: string) =>
    focus !== null &&
    focus !== id &&
    !scheme.edges.some(
      (e) => (e.from === focus && e.to === id) || (e.to === focus && e.from === id)
    );

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          style={{ minWidth: Math.min(W, 720) }}
          role="img"
          aria-label={scheme.title}
        >
          <defs>
            <marker id="nx-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,1 L7,4 L0,7 z" fill="#4a4f52" />
            </marker>
          </defs>

          {scheme.edges.map((edge, i) => {
            const d = pathFor(edge.from, edge.to);
            if (!d) return null;
            const active = focus === edge.from || focus === edge.to;
            const faded = focus !== null && !active;
            return (
              <g key={`${edge.from}-${edge.to}`} opacity={faded ? 0.2 : 1}>
                <path
                  d={d}
                  fill="none"
                  stroke={active ? "#2f66ff" : "#4a4f52"}
                  strokeWidth={active ? 2 : 1.4}
                  markerEnd="url(#nx-arrow)"
                />
                {!reduced && (
                  <>
                    <path
                      d={d}
                      fill="none"
                      stroke="#2f66ff"
                      strokeWidth={1.4}
                      className="nx-march"
                      opacity={0.55}
                    />
                    <circle r={2.6} fill="#2f66ff">
                      <animateMotion
                        dur={`${2.4 + (i % 3) * 0.4}s`}
                        repeatCount="indefinite"
                        path={d}
                        begin={`${i * 0.35}s`}
                      />
                    </circle>
                  </>
                )}
                {edge.label && (
                  // sobre la línea y centrada en el hueco entre columnas: con
                  // el rótulo a la altura del trazo, las cajas lo tapaban
                  <text
                    x={(pos.get(edge.from)!.x + BOX_W + pos.get(edge.to)!.x) / 2}
                    y={(pos.get(edge.from)!.y + pos.get(edge.to)!.y) / 2 + BOX_H / 2 - 8}
                    textAnchor="middle"
                    fontSize={8.5}
                    fill="#8e9ba5"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {scheme.nodes.map((node, i) => {
            const p = pos.get(node.id)!;
            const color = KIND_COLOR[node.kind];
            const isFocus = focus === node.id;
            return (
              <g
                key={node.id}
                className="nx-pop cursor-pointer"
                style={{ "--nx-i": i, opacity: dimmed(node.id) ? 0.32 : 1 } as React.CSSProperties}
                onMouseEnter={() => setFocus(node.id)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(node.id)}
                onBlur={() => setFocus(null)}
                tabIndex={0}
                role="button"
                aria-label={`${node.label}: ${node.sub}`}
              >
                <rect
                  x={p.x}
                  y={p.y}
                  width={BOX_W}
                  height={BOX_H}
                  rx={4}
                  fill={isFocus ? `${color}26` : "#1a1e21"}
                  stroke={color}
                  strokeWidth={isFocus ? 1.8 : 1.2}
                />
                <rect x={p.x} y={p.y} width={3} height={BOX_H} fill={color} />
                <text x={p.x + 12} y={p.y + 22} fontSize={12} fontWeight={600} fill="#e8edf2">
                  {node.label}
                </text>
                <text x={p.x + 12} y={p.y + 38} fontSize={9.5} fill="#9fb0be">
                  {node.sub}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {scheme.legend.map((entry) => (
          <span key={entry.kind} className="flex items-center gap-1.5 text-[10px] text-ink-secondary">
            <span className="h-2.5 w-2.5" style={{ background: KIND_COLOR[entry.kind] }} aria-hidden />
            {entry.label}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-ink-muted">
          Pasá el cursor por un bloque para aislar sus conexiones
        </span>
      </div>
    </div>
  );
}
