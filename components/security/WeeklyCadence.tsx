"use client";

import { CATEGORICAL, CHART_THEME } from "@/lib/palette";
import { formatUsdCompact } from "@/lib/format";
import type { CadenceWeek } from "@/lib/hackStats";

// Una celda por semana. Responde a la pregunta que da origen a la sección:
// ¿de verdad hay un incidente casi todas las semanas? Las semanas limpias se
// ven vacías, no desaparecen.

const BASE = CATEGORICAL[1]; // naranja
const CAP = 6; // incidentes que saturan el color

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function cellFill(count: number): string {
  if (count === 0) return "#1c2023";
  const t = Math.min(count / CAP, 1);
  const r = parseInt(BASE.slice(1, 3), 16);
  const g = parseInt(BASE.slice(3, 5), 16);
  const b = parseInt(BASE.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${(0.22 + 0.78 * t).toFixed(2)})`;
}

function weekLabel(start: string): string {
  const end = new Date(Date.parse(start + "T00:00:00Z") + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return `${start} → ${end}`;
}

export function WeeklyCadence({ weeks }: { weeks: CadenceWeek[] }) {
  if (weeks.length === 0) return null;

  const SIZE = 12;
  const GAP = 3;
  const TOP = 13;
  const W = weeks.length * (SIZE + GAP);
  const H = TOP + SIZE + 4;

  // etiqueta de mes en la primera semana que cae en un mes nuevo
  const ticks: { index: number; label: string }[] = [];
  let lastMonth = "";
  weeks.forEach((week, index) => {
    const month = week.start.slice(0, 7);
    if (month !== lastMonth) {
      ticks.push({ index, label: MONTHS[Number(month.slice(5, 7)) - 1] });
      lastMonth = month;
    }
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Incidentes por semana">
      {ticks.map((tick) => (
        <text
          key={tick.index}
          x={tick.index * (SIZE + GAP)}
          y={9}
          fontSize="8"
          fill={CHART_THEME.axis}
        >
          {tick.label}
        </text>
      ))}
      {weeks.map((week, index) => (
        <rect
          key={week.start}
          x={index * (SIZE + GAP)}
          y={TOP}
          width={SIZE}
          height={SIZE}
          rx="2"
          fill={cellFill(week.count)}
        >
          <title>
            {weekLabel(week.start)}
            {"\n"}
            {week.count === 0
              ? "sin incidentes registrados"
              : `${week.count} incidente${week.count === 1 ? "" : "s"} · ${formatUsdCompact(week.amountUsd)}`}
          </title>
        </rect>
      ))}
    </svg>
  );
}

export function CadenceLegend() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-ink-muted">
      <span>0</span>
      {[0, 1, 2, 4, 6].map((n) => (
        <span
          key={n}
          className="inline-block h-2.5 w-2.5 rounded-[2px]"
          style={{ background: cellFill(n) }}
        />
      ))}
      <span>{CAP}+ incidentes por semana</span>
    </div>
  );
}
