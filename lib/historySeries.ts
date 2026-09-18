import type { HistoryPoint } from "./historyTypes";

// Operaciones puras sobre series diarias. Viven fuera de las fuentes para
// poder probarlas sin red y para que la ficha del cliente recorte y resuma con
// exactamente las mismas reglas que usa el servidor.

const DAY = 86_400_000;

/**
 * Una serie diaria por fecha UTC. Varias fuentes agregan un último punto
 * intradía con la hora de consulta: se conserva el valor más reciente de cada
 * día y se descartan valores no finitos o negativos.
 */
export function toDaily(raw: { time: number; value: unknown }[]): HistoryPoint[] {
  const byDay = new Map<string, { time: number; value: number }>();
  for (const point of raw) {
    const value = Number(point.value);
    if (!Number.isFinite(point.time) || !Number.isFinite(value) || value < 0) continue;
    const date = new Date(point.time).toISOString().slice(0, 10);
    const previous = byDay.get(date);
    if (!previous || point.time >= previous.time) byDay.set(date, { time: point.time, value });
  }
  return [...byDay.entries()]
    .map(([date, point]) => ({ date, value: point.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Tolerancia de arrastre al final de una serie: su último punto puede llegar
 *  con uno o dos días de atraso respecto de las demás. */
const TRAILING_FILL_DAYS = 3;

/**
 * Valores de una serie sobre un eje de fechas ajeno (ordenado).
 *
 * Dentro del rango propio de la serie, un día faltante arrastra el último
 * valor conocido: sin eso, un hueco de la fuente aparece como una caída que no
 * ocurrió. Antes de su primer dato aporta cero —el protocolo no existía— y
 * después de su último dato solo se arrastra unos días; más allá, se asume
 * que dejó de reportar.
 */
export function alignSeries(dates: string[], series: HistoryPoint[]): number[] {
  if (series.length === 0) return dates.map(() => 0);
  const values = new Map(series.map((p) => [p.date, p.value]));
  const first = series[0].date;
  const last = series[series.length - 1].date;
  const lastTime = Date.parse(last);
  let carry: number | null = null;

  return dates.map((date) => {
    if (date < first) return 0;
    const own = values.get(date);
    if (own !== undefined) carry = own;
    if (carry === null) return 0;
    if (date > last && Date.parse(date) - lastTime > TRAILING_FILL_DAYS * DAY) return 0;
    return carry;
  });
}

/** Unión ordenada de las fechas de varias series. */
export function unionDates(seriesList: HistoryPoint[][]): string[] {
  return [...new Set(seriesList.flatMap((series) => series.map((p) => p.date)))].sort();
}

/** Suma de series que componen un total, con la regla de `alignSeries`. */
export function sumSeries(seriesList: HistoryPoint[][]): HistoryPoint[] {
  const usable = seriesList.filter((series) => series.length > 0);
  if (usable.length === 0) return [];
  const dates = unionDates(usable);
  const aligned = usable.map((series) => alignSeries(dates, series));
  return dates.map((date, index) => ({
    date,
    value: aligned.reduce((sum, values) => sum + values[index], 0),
  }));
}

/** Últimos `days` días calendario, anclados en la última fecha publicada. */
export function sliceDays(points: HistoryPoint[], days: number | null): HistoryPoint[] {
  if (days === null || points.length === 0) return points;
  const end = Date.parse(points[points.length - 1].date);
  const start = end - days * DAY;
  return points.filter((p) => Date.parse(p.date) > start);
}

export type RebasedRow = { date: string; left: number; right: number };

/**
 * Dos series de escalas distintas sobre un índice común: ambas valen 100 en
 * el primer día en que las dos tienen dato positivo, y solo se conservan las
 * fechas compartidas. Así un TVL de miles de millones y un precio de centavos
 * se leen en un mismo eje sin inventar valores en los días que falta uno.
 */
export function rebaseTogether(left: HistoryPoint[], right: HistoryPoint[]): RebasedRow[] {
  const rightByDate = new Map(right.map((p) => [p.date, p.value]));
  const common = left
    .filter((p) => rightByDate.has(p.date))
    .map((p) => ({ date: p.date, left: p.value, right: rightByDate.get(p.date)! }));
  const start = common.findIndex((row) => row.left > 0 && row.right > 0);
  if (start === -1) return [];
  const base = common[start];
  return common.slice(start).map((row) => ({
    date: row.date,
    left: (row.left / base.left) * 100,
    right: (row.right / base.right) * 100,
  }));
}

export type SeriesStats = {
  first: HistoryPoint;
  last: HistoryPoint;
  /** punto contra el que se mide la variación: el primero con valor material */
  base: HistoryPoint | null;
  /** variación entre la base y el último punto; null si no hay base material */
  changePct: number | null;
  max: HistoryPoint;
  min: HistoryPoint;
  /** distancia del último valor al máximo del rango, ≤ 0 */
  fromMaxPct: number | null;
};

/**
 * Una base menor al 1% del máximo no es una base: es el arranque de la serie.
 * Medir contra ella da variaciones de millones por ciento —aritmética correcta,
 * lectura absurda—, así que la variación arranca en el primer valor material y
 * la ficha dice desde qué fecha.
 */
const MATERIAL_BASE_SHARE = 0.01;

export function seriesStats(points: HistoryPoint[]): SeriesStats | null {
  if (points.length === 0) return null;
  let max = points[0];
  let min = points[0];
  for (const point of points) {
    if (point.value > max.value) max = point;
    if (point.value < min.value) min = point;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const found = points.find((p) => p.value > 0 && p.value >= max.value * MATERIAL_BASE_SHARE) ?? null;
  // si la única base material es el último punto, no hay rango que medir
  const base = found && found.date !== last.date ? found : null;
  return {
    first,
    last,
    base,
    changePct: base ? ((last.value - base.value) / base.value) * 100 : null,
    max,
    min,
    fromMaxPct: max.value > 0 ? ((last.value - max.value) / max.value) * 100 : null,
  };
}
