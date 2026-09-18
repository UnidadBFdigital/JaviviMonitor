// Agregaciones del registro de incidentes. Viven aparte de la fuente porque
// se recalculan en el cliente cada vez que cambia un filtro: el servidor
// manda el registro crudo una sola vez y acá se derivan todas las vistas.

import type { HackEvent } from "@/lib/sources/hacks";

export type Bucket = { key: string; count: number; amountUsd: number };
export type TimelinePoint = { label: string; count: number; amountUsd: number };
export type CadenceWeek = { start: string; count: number; amountUsd: number };

/**
 * Agrupa por una clave que puede ser múltiple (un incidente afecta a varias
 * redes). Cuando lo es, el incidente suma en CADA clave: la lectura correcta
 * de la barra es "incidentes que tocaron esta red", no una partición.
 */
export function bucketBy(events: HackEvent[], keysOf: (e: HackEvent) => string[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const event of events) {
    for (const key of keysOf(event)) {
      const entry = map.get(key) ?? { key, count: 0, amountUsd: 0 };
      entry.count += 1;
      entry.amountUsd += event.amountUsd ?? 0;
      map.set(key, entry);
    }
  }
  return [...map.values()];
}

export function sortBuckets(buckets: Bucket[], metric: "amount" | "count"): Bucket[] {
  return [...buckets].sort((a, b) =>
    metric === "amount" ? b.amountUsd - a.amountUsd : b.count - a.count
  );
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * Serie temporal continua: los meses sin incidentes se emiten en cero en vez
 * de desaparecer. Un hueco en el eje mentiría sobre la cadencia.
 */
export function buildTimeline(
  events: HackEvent[],
  granularity: "month" | "year"
): TimelinePoint[] {
  if (events.length === 0) return [];
  const cut = granularity === "month" ? 7 : 4;
  const map = new Map<string, TimelinePoint>();
  for (const event of events) {
    const label = event.date.slice(0, cut);
    const entry = map.get(label) ?? { label, count: 0, amountUsd: 0 };
    entry.count += 1;
    entry.amountUsd += event.amountUsd ?? 0;
    map.set(label, entry);
  }

  const labels = [...map.keys()].sort();
  const first = labels[0];
  const last = labels[labels.length - 1];
  const out: TimelinePoint[] = [];
  if (granularity === "year") {
    for (let y = Number(first); y <= Number(last); y++) {
      const label = String(y);
      out.push(map.get(label) ?? { label, count: 0, amountUsd: 0 });
    }
    return out;
  }
  for (let label = first; label <= last; label = addMonths(label, 1)) {
    out.push(map.get(label) ?? { label, count: 0, amountUsd: 0 });
  }
  return out;
}

/** Lunes (UTC) de la semana que contiene `iso`. */
function weekStart(iso: string): string {
  const date = new Date(iso + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/**
 * Últimas `weeks` semanas hasta `anchor`, incluidas las vacías. El dato que
 * interesa no es cuántas hubo sino cuántas semanas seguidas hubo alguna.
 */
export function weeklyCadence(events: HackEvent[], weeks: number, anchor: string): CadenceWeek[] {
  const map = new Map<string, CadenceWeek>();
  for (const event of events) {
    const start = weekStart(event.date);
    const entry = map.get(start) ?? { start, count: 0, amountUsd: 0 };
    entry.count += 1;
    entry.amountUsd += event.amountUsd ?? 0;
    map.set(start, entry);
  }

  const out: CadenceWeek[] = [];
  const cursor = new Date(weekStart(anchor) + "T00:00:00Z");
  cursor.setUTCDate(cursor.getUTCDate() - 7 * (weeks - 1));
  for (let i = 0; i < weeks; i++) {
    const start = cursor.toISOString().slice(0, 10);
    out.push(map.get(start) ?? { start, count: 0, amountUsd: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return out;
}

/** Racha más larga de semanas consecutivas con al menos un incidente. */
export function longestStreak(cadence: CadenceWeek[]): number {
  let best = 0;
  let run = 0;
  for (const week of cadence) {
    run = week.count > 0 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

export function isoDaysAgo(iso: string, from: Date = new Date()): number {
  const then = Date.parse(iso + "T00:00:00Z");
  const now = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

/** Fecha ISO de hace `months` meses, en UTC. */
export function monthsAgo(months: number, from: Date = new Date()): string {
  const date = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - months, from.getUTCDate())
  );
  return date.toISOString().slice(0, 10);
}
