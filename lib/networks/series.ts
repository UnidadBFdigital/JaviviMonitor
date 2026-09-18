import type { NetworkMetrics, SeriesPoint } from "./types";

const DAY = 86_400_000;

/** Ventanas de calendario ancladas en la última fecha publicada. */
export function calendarValues(series: SeriesPoint[] | undefined, days: number, offset = 0): number[] {
  if (!series?.length) return [];
  const end = Date.parse(series[series.length - 1].date) - offset * DAY;
  return series.filter((p) => {
    const date = Date.parse(p.date);
    return date > end - days * DAY && date <= end && Number.isFinite(p.value);
  }).map((p) => p.value);
}

export function windowChangePct(series: SeriesPoint[] | undefined, days: number): number | null {
  const recent = calendarValues(series, days);
  const previous = calendarValues(series, days, days);
  // No convertir ventanas incompletas en cambios comparables.
  if (recent.length !== days || previous.length !== days) return null;
  const before = previous.reduce((sum, v) => sum + v, 0) / days;
  const now = recent.reduce((sum, v) => sum + v, 0) / days;
  return before === 0 ? null : (now - before) / before * 100;
}

/**
 * Direcciones activas con la fuente que las publicó.
 *
 * DeFiLlama publica 0 para algunas redes que sí tienen actividad medida por
 * growthepie (OP Mainnet entre ellas). Un cero de una fuente que no cubre la
 * métrica no es una observación: antes de mostrarlo se busca la otra serie, y
 * la interfaz dice cuál se está leyendo. Si ninguna publica, queda en null.
 */
export function activeAddresses(network: NetworkMetrics): { value: number | null; source: string } {
  const dashboard = network.activity.activeAddresses24h;
  if (dashboard !== null && dashboard > 0) return { value: dashboard, source: "DeFiLlama · 24h" };
  const daily = network.activity.dailyActiveAddresses;
  if (daily !== null && daily > 0) return { value: daily, source: "growthepie · día publicado" };
  return {
    value: null,
    source:
      dashboard === 0
        ? "DeFiLlama publica cero y growthepie no cubre esta red"
        : "Ninguna fuente publica direcciones activas para esta red",
  };
}

const STALLED_PUSH_DAYS = 30;
const STALLED_MIN_PREVIOUS = 50;

/**
 * La estadística de commits de GitHub cuenta solo la rama principal. Si esa
 * rama no registra commits en 12 semanas, el trimestre anterior sí tuvo
 * actividad y el repositorio recibió pushes hace poco, el desarrollo se está
 * publicando en otras ramas: el cero es verdadero para la rama y falso para la
 * red. Devuelve el motivo para publicarlo sin cifra, o null si el conteo sirve.
 */
export function defaultBranchStalled(
  repo: { repo: string; commits12w: number | null; commitsPrev12w: number | null; pushedAt: string | null },
  now: number
): string | null {
  if (repo.commits12w !== 0 || (repo.commitsPrev12w ?? 0) < STALLED_MIN_PREVIOUS || !repo.pushedAt) return null;
  const pushed = Date.parse(repo.pushedAt);
  if (!Number.isFinite(pushed) || now - pushed > STALLED_PUSH_DAYS * DAY) return null;
  return `La rama principal de ${repo.repo} no registra commits en 12 semanas, pero el repositorio recibió pushes el ${repo.pushedAt.slice(0, 10)}: el desarrollo se publica en otras ramas y el conteo no mediría la actividad real.`;
}

/**
 * Comisiones de red por usuario activo en 24h: la única medida de costo que
 * existe para todo el universo. growthepie publica costo mediano por
 * transacción solo para Ethereum y sus L2; DeFiLlama publica comisiones de red
 * y direcciones activas para todas. No es el costo de una transacción: es
 * cuánto gasta en comisiones, en promedio, una dirección activa en un día.
 */
export function feesPerActiveUser(network: NetworkMetrics): { value: number | null; source: string } {
  const fees = network.liquidity.chainFees24hUsd;
  if (fees === null) return { value: null, source: "DeFiLlama no publica comisiones de red para esta red" };
  const users = activeAddresses(network);
  if (users.value === null) return { value: null, source: users.source };
  return { value: fees / users.value, source: `comisiones DeFiLlama ÷ direcciones ${users.source}` };
}

/**
 * Serie indexada a base 100 en su primer valor útil. Comparar crecimiento
 * relativo exige quitar la escala: en valores absolutos, una red con mil
 * commits aplasta a otra que triplicó los suyos desde treinta.
 */
export function indexToBase100(series: SeriesPoint[]): SeriesPoint[] {
  const first = series.find((point) => Number.isFinite(point.value) && point.value > 0);
  if (!first) return [];
  return series
    .filter((point) => Number.isFinite(point.value))
    .map((point) => ({ date: point.date, value: (point.value / first.value) * 100 }));
}
