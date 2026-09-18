"use client";

import { useMemo, useState } from "react";
import { exportCsv } from "@/lib/chartExport";
import { CATEGORICAL, STATUS } from "@/lib/palette";
import type { HistoryTarget } from "@/lib/historyTypes";
import { useHistory } from "@/components/history/HistoryProvider";

// Tabla densa tipo terminal: buscar, ordenar, ocultar y fijar columnas,
// modo compacto, header pegajoso, export CSV y vista gráfica.
//
// Vista gráfica: toda tabla con columnas numéricas se puede ver como ranking
// de barras de la métrica elegida. La tabla sigue siendo la gemela accesible
// del gráfico: los mismos valores, a un clic. Con `rowHistory`, cada fila y
// cada barra abren la ficha lateral con el histórico de esa entidad.

export type Column<T> = {
  key: string;
  header: string;
  /** valor crudo para ordenar, buscar y exportar */
  value: (row: T) => string | number | null;
  /** render opcional; por defecto muestra el valor formateado */
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** columna numérica: ordena por número, alinea a la derecha y es graficable */
  numeric?: boolean;
  /** no se puede ocultar (identificador de la fila) */
  required?: boolean;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

/** Barras a la vista: más allá, el ranking deja de leerse de un vistazo. */
const CHART_LIMIT = 30;

/** Un clic sobre un control propio de la celda no debe abrir la ficha. */
function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("a,button,input,select,textarea,label") !== null;
}

function TableBars<T>({
  rows,
  labelColumn,
  metric,
  historyFor,
  onOpen,
}: {
  rows: T[];
  labelColumn: Column<T>;
  metric: Column<T>;
  historyFor: ((row: T) => HistoryTarget | null) | null;
  onOpen: (target: HistoryTarget) => void;
}) {
  const data = rows.flatMap((row) => {
    const value = metric.value(row);
    return typeof value === "number" && Number.isFinite(value)
      ? [{ row, label: String(labelColumn.value(row) ?? "—"), value }]
      : [];
  });
  const missing = rows.length - data.length;
  const shown = [...data].sort((a, b) => b.value - a.value).slice(0, CHART_LIMIT);

  if (shown.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-ink-muted">
        {metric.header} no tiene valores numéricos en las filas filtradas.
      </p>
    );
  }

  // con valores negativos las barras divergen desde un eje central
  const signed = shown.some((d) => d.value < 0);
  const maxAbs = Math.max(...shown.map((d) => Math.abs(d.value))) || 1;

  return (
    <div>
      <ul className="space-y-0.5">
        {shown.map((d, i) => {
          const length = (Math.abs(d.value) / maxAbs) * (signed ? 50 : 100);
          const negative = d.value < 0;
          const color = signed ? (negative ? STATUS.down : STATUS.up) : CATEGORICAL[0];
          const target = historyFor?.(d.row) ?? null;

          const content = (
            <>
              <span
                className="w-32 shrink-0 truncate text-left text-[11px] text-ink-secondary transition-colors group-hover:text-ink"
                title={d.label}
              >
                {d.label}
              </span>
              <span className="relative h-3 min-w-0 flex-1">
                {signed && <span className="absolute inset-y-0 left-1/2 w-px bg-line" aria-hidden />}
                <span
                  className="bf-grow-x absolute inset-y-0"
                  style={
                    {
                      width: `${Math.max(length, 0.8)}%`,
                      left: signed ? (negative ? `${50 - length}%` : "50%") : 0,
                      transformOrigin: negative ? "right center" : "left center",
                      background: color,
                      // extremo de dato redondeado, cuadrado contra la línea base
                      borderRadius: negative ? "4px 0 0 4px" : "0 4px 4px 0",
                      "--bf-i": i,
                    } as React.CSSProperties
                  }
                />
              </span>
              <span className="w-24 shrink-0 text-right text-[11px] tabular-nums">
                {metric.render ? metric.render(d.row) : d.value}
              </span>
            </>
          );

          return (
            <li key={`${d.label}-${i}`}>
              {target ? (
                <button
                  type="button"
                  onClick={() => onOpen(target)}
                  title={`Ver histórico de ${d.label}`}
                  className="group flex w-full items-center gap-2 rounded px-1 py-1 transition-colors hover:bg-ice/40"
                >
                  {content}
                </button>
              ) : (
                <div className="group flex items-center gap-2 px-1 py-1">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-ink-muted">
        {shown.length < data.length ? `Top ${shown.length} de ${data.length}` : `${data.length} filas`} por{" "}
        {metric.header}
        {missing > 0 && ` · ${missing} sin dato`}
        {historyFor && " · tocá una barra para ver su histórico"}
      </p>
    </div>
  );
}

export function DataTable<T>({
  rows,
  columns,
  exportName,
  initialSort,
  pinFirst = true,
  emptyLabel = "Sin datos",
  maxHeight = "max-h-[26rem]",
  rowHistory,
}: {
  rows: T[];
  columns: Column<T>[];
  exportName: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** fija la primera columna al hacer scroll horizontal */
  pinFirst?: boolean;
  emptyLabel?: string;
  maxHeight?: string;
  /** entidad cuyo histórico abre la fila; null si esa fila no tiene serie */
  rowHistory?: (row: T) => HistoryTarget | null;
}) {
  const history = useHistory();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(initialSort ?? null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [compact, setCompact] = useState(false);
  const [pinned, setPinned] = useState(pinFirst);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<"table" | "chart">("table");
  const [metricKey, setMetricKey] = useState<string | null>(null);

  const visible = columns.filter((c) => !hidden.has(c.key));
  const numericColumns = columns.filter((c) => c.numeric);
  const metric =
    numericColumns.find((c) => c.key === metricKey) ??
    numericColumns.find((c) => c.key === initialSort?.key) ??
    numericColumns[0] ??
    null;
  const historyFor = rowHistory && history.enabled ? rowHistory : null;

  const processed = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = rows.filter((r) =>
        columns.some((c) => String(c.value(r) ?? "").toLowerCase().includes(q))
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        out = [...out].sort((a, b) => {
          const va = col.value(a);
          const vb = col.value(b);
          if (va === null || va === undefined) return 1;
          if (vb === null || vb === undefined) return -1;
          const cmp =
            typeof va === "number" && typeof vb === "number"
              ? va - vb
              : String(va).localeCompare(String(vb), "es");
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, columns, query, sort]);

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  }

  function toggleColumn(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function download() {
    exportCsv(
      processed.map((r) =>
        Object.fromEntries(visible.map((c) => [c.header, c.value(r)]))
      ),
      exportName
    );
  }

  function openRow(row: T) {
    const target = historyFor?.(row);
    if (target) history.open(target);
  }

  const pad = compact ? "py-0.5" : "py-1.5";
  const toggleClass = (on: boolean) =>
    `rounded border px-1.5 py-0.5 text-[10px] ${
      on ? "border-electric/50 bg-electric/15 text-electric" : "border-line text-ink-secondary hover:bg-ice/50"
    }`;

  return (
    <div>
      {/* barra de controles */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar…"
          className="w-36 rounded border border-line bg-surface px-2 py-1 text-xs outline-none placeholder:text-ink-muted focus:border-core"
        />
        <span className="text-[10px] tabular-nums text-ink-muted">
          {processed.length}
          {processed.length !== rows.length && ` / ${rows.length}`} filas
        </span>

        {metric && (
          <div className="flex" role="group" aria-label="Vista">
            <button
              type="button"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              className={`${toggleClass(view === "table")} rounded-r-none`}
            >
              Tabla
            </button>
            <button
              type="button"
              onClick={() => setView("chart")}
              aria-pressed={view === "chart"}
              className={`${toggleClass(view === "chart")} -ml-px rounded-l-none`}
              title="Ver la tabla como ranking de barras"
            >
              Gráfico
            </button>
          </div>
        )}

        {view === "chart" && metric && (
          <label className="flex items-center gap-1 text-[10px] text-ink-muted">
            Métrica
            <select
              value={metric.key}
              onChange={(e) => setMetricKey(e.target.value)}
              className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink outline-none focus:border-core"
            >
              {numericColumns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.header}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="ml-auto flex gap-1">
          {view === "table" && (
            <>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-secondary hover:bg-ice/50"
                  title="Mostrar u ocultar columnas"
                >
                  Columnas
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 z-20 mt-1 w-44 rounded border border-line bg-card-raised p-1.5 shadow-lg">
                      {columns.map((c) => (
                        <label
                          key={c.key}
                          className={`flex items-center gap-2 rounded px-1.5 py-1 text-[11px] ${
                            c.required ? "text-ink-muted" : "cursor-pointer text-ink-secondary hover:bg-ice/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!hidden.has(c.key)}
                            disabled={c.required}
                            onChange={() => toggleColumn(c.key)}
                            className="accent-electric"
                          />
                          {c.header}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setPinned(!pinned)}
                className={toggleClass(pinned)}
                title="Fijar la primera columna al hacer scroll horizontal"
              >
                Fijar 1ª
              </button>
              <button onClick={() => setCompact(!compact)} className={toggleClass(compact)} title="Modo compacto">
                Compacto
              </button>
            </>
          )}
          <button
            onClick={download}
            className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-secondary hover:bg-ice/50"
            title="Exportar lo visible a CSV"
          >
            CSV
          </button>
        </div>
      </div>

      {view === "chart" && metric ? (
        <div className={`${maxHeight} overflow-auto`}>
          <TableBars
            rows={processed}
            labelColumn={columns[0]}
            metric={metric}
            historyFor={historyFor}
            onOpen={history.open}
          />
        </div>
      ) : (
        <div className={`${maxHeight} overflow-auto`}>
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-[1] bg-card">
              <tr className="text-left text-[10px] uppercase tracking-wide text-ink-muted">
                {visible.map((c, i) => {
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c.key)}
                      className={`cursor-pointer select-none border-b border-line pb-1.5 font-medium hover:text-ink ${
                        c.align === "right" || c.numeric ? "text-right" : "text-left"
                      } ${i === 0 ? "pr-3" : "px-2"} ${
                        pinned && i === 0 ? "sticky left-0 z-[2] bg-card" : ""
                      } ${active ? "text-ink" : ""}`}
                      title="Clic para ordenar"
                    >
                      {c.header}
                      {active && <span className="ml-1">{sort!.dir === "asc" ? "▲" : "▼"}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {processed.length === 0 && (
                <tr>
                  <td colSpan={visible.length} className="py-6 text-center text-xs text-ink-muted">
                    {emptyLabel}
                  </td>
                </tr>
              )}
              {processed.map((row, ri) => {
                const target = historyFor?.(row) ?? null;
                return (
                  <tr
                    key={ri}
                    onClick={target ? (event) => !isInteractive(event.target) && history.open(target) : undefined}
                    className={`group border-b border-line/50 last:border-0 hover:bg-ice/30 ${
                      target ? "cursor-pointer" : ""
                    }`}
                  >
                    {visible.map((c, i) => (
                      <td
                        key={c.key}
                        className={`${pad} ${
                          c.align === "right" || c.numeric ? "text-right tabular-nums" : "text-left"
                        } ${i === 0 ? "pr-3" : "px-2"} ${
                          pinned && i === 0 ? "sticky left-0 bg-card" : ""
                        }`}
                      >
                        {c.render ? c.render(row) : (c.value(row) ?? "—")}
                        {i === 0 && target && (
                          <button
                            type="button"
                            onClick={() => openRow(row)}
                            aria-label={`Ver histórico de ${target.label}`}
                            className="ml-1.5 align-middle text-[10px] text-core opacity-0 transition-opacity hover:text-electric focus:opacity-100 group-hover:opacity-100"
                          >
                            ↗
                          </button>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
