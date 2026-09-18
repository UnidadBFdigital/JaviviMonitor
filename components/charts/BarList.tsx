"use client";

import { colorAt } from "@/lib/palette";

// Ranking en barras horizontales. Reemplaza a las barras sueltas que cada
// card dibujaba por su cuenta, y aplica la especificación de marca: extremo
// de dato redondeado 4px anclado a la línea base, separación de 2px contra la
// superficie, y color asignado por orden fijo de entidad (nunca por rango
// filtrado). La barra crece al entrar; el hover marca la fila completa.
//
// Con `onSelect`, cada fila es un botón: abre el histórico de esa entidad.

export type BarItem = {
  label: string;
  value: number;
  /** texto secundario bajo la etiqueta */
  note?: string;
};

export function BarList({
  items,
  formatValue,
  total,
  showShare = true,
  onSelect,
}: {
  items: BarItem[];
  formatValue: (v: number) => string;
  /** denominador del porcentaje; por defecto la suma de los items mostrados */
  total?: number;
  showShare?: boolean;
  /** vuelve clicable cada fila (histórico de la entidad) */
  onSelect?: (item: BarItem, index: number) => void;
}) {
  if (items.length === 0) return null;

  const max = Math.max(...items.map((i) => i.value)) || 1;
  const denom = total ?? items.reduce((s, i) => s + i.value, 0);

  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => {
        const share = denom > 0 ? (item.value / denom) * 100 : 0;
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate text-left text-ink-secondary transition-colors group-hover:text-ink">
                {item.label}
                {item.note && (
                  <span className="ml-1.5 text-[10px] text-ink-muted">{item.note}</span>
                )}
                {onSelect && (
                  <span className="ml-1.5 text-[10px] text-core opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    ver histórico ↗
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatValue(item.value)}
                {showShare && (
                  <span className="ml-1.5 text-[10px] text-ink-muted">{share.toFixed(1)}%</span>
                )}
              </span>
            </span>
            <span className="mt-1 block h-2 rounded-sm bg-ice/70">
              <span
                className="bf-grow-x block h-full transition-opacity group-hover:opacity-100"
                style={
                  {
                    width: `${Math.max((item.value / max) * 100, 1.2)}%`,
                    background: colorAt(i),
                    borderRadius: "2px 4px 4px 2px",
                    opacity: 0.88,
                    "--bf-i": i,
                  } as React.CSSProperties
                }
                title={`${item.label} · ${formatValue(item.value)} · ${share.toFixed(1)}%`}
              />
            </span>
          </>
        );

        return (
          <li key={item.label} className="group">
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item, i)}
                aria-label={`Ver histórico de ${item.label}`}
                className="group block w-full rounded text-left outline-offset-2"
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
