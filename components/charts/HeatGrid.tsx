"use client";

// Matriz de calor genérica (correlaciones, actividad horaria).
// Diverging: azul (negativo) → gris (0) → verde (positivo) para correlación.

export function HeatGrid({
  rows,
  cols,
  values, // values[rowIdx][colIdx], null = no disponible
  min = -1,
  max = 1,
  formatValue = (v: number) => v.toFixed(2),
}: {
  rows: string[];
  cols: string[];
  values: (number | null)[][];
  min?: number;
  max?: number;
  formatValue?: (v: number) => string;
}) {
  function cellColor(v: number): string {
    const mid = (min + max) / 2;
    const t = Math.max(-1, Math.min(1, (v - mid) / ((max - min) / 2 || 1)));
    if (t >= 0) return `rgba(25,158,112,${(0.15 + 0.65 * t).toFixed(2)})`;
    return `rgba(57,135,229,${(0.15 + 0.65 * -t).toFixed(2)})`;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="px-1 pb-1 text-center font-medium text-ink-secondary">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <td className="pr-2 text-right font-medium text-ink-secondary">{r}</td>
              {cols.map((c, ci) => {
                const v = values[ri]?.[ci];
                return (
                  <td
                    key={c}
                    title={v === null || v === undefined ? "No disponible" : `${r} × ${c}: ${formatValue(v)}`}
                    className="h-9 w-14 rounded text-center tabular-nums"
                    style={{
                      background:
                        v === null || v === undefined ? "#222628" : cellColor(v),
                      color: "#e8edf2",
                    }}
                  >
                    {v === null || v === undefined ? "—" : formatValue(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
