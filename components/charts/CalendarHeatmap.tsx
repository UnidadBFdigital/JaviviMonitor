"use client";

import { STATUS, CHART_THEME } from "@/lib/palette";

// Calendar heatmap: una celda por día, en columnas semanales.
// Diverging verde/rojo por polaridad del valor (retorno diario).

export type CalendarDay = { date: string; value: number | null };

const DOW = ["L", "M", "M", "J", "V", "S", "D"];

function cellColor(v: number | null, cap: number): string {
  if (v === null) return "#222628";
  const t = Math.min(Math.abs(v) / cap, 1);
  const base = v >= 0 ? STATUS.up : STATUS.down;
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${(0.12 + 0.75 * t).toFixed(2)})`;
}

export function CalendarHeatmap({
  days,
  formatValue,
  cap = 5,
}: {
  days: CalendarDay[];
  formatValue: (v: number) => string;
  /** valor que satura el color (ej. 5 = ±5% satura) */
  cap?: number;
}) {
  if (days.length === 0) return null;

  // índice de semana relativo al primer día (lunes = 0)
  const first = new Date(days[0].date + "T00:00:00Z");
  const firstDow = (first.getUTCDay() + 6) % 7; // lunes = 0

  const cells = days.map((d, i) => {
    const offset = firstDow + i;
    return { ...d, week: Math.floor(offset / 7), dow: offset % 7 };
  });
  const weeks = Math.max(...cells.map((c) => c.week)) + 1;

  const SIZE = 13;
  const GAP = 3;
  const LEFT = 16;
  const TOP = 14;
  const W = LEFT + weeks * (SIZE + GAP);
  const H = TOP + 7 * (SIZE + GAP);

  // etiqueta de mes en la primera semana de cada mes
  const monthLabels: { week: number; label: string }[] = [];
  let lastMonth = "";
  for (const c of cells) {
    const month = c.date.slice(0, 7);
    if (month !== lastMonth) {
      monthLabels.push({
        week: c.week,
        label: new Date(c.date + "T00:00:00Z").toLocaleDateString("es-BO", {
          month: "short",
          timeZone: "UTC",
        }),
      });
      lastMonth = month;
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img">
      {monthLabels.map((m) => (
        <text
          key={m.week}
          x={LEFT + m.week * (SIZE + GAP)}
          y={9}
          fontSize="9"
          fill={CHART_THEME.axis}
        >
          {m.label}
        </text>
      ))}
      {DOW.map((d, i) =>
        i % 2 === 0 ? (
          <text
            key={i}
            x={0}
            y={TOP + i * (SIZE + GAP) + SIZE - 3}
            fontSize="8"
            fill={CHART_THEME.axis}
          >
            {d}
          </text>
        ) : null
      )}
      {cells.map((c) => (
        <rect
          key={c.date}
          x={LEFT + c.week * (SIZE + GAP)}
          y={TOP + c.dow * (SIZE + GAP)}
          width={SIZE}
          height={SIZE}
          rx="2.5"
          fill={cellColor(c.value, cap)}
        >
          <title>
            {c.date}: {c.value === null ? "sin dato" : formatValue(c.value)}
          </title>
        </rect>
      ))}
    </svg>
  );
}
