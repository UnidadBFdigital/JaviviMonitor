import { formatUsdCompact } from "@/lib/format";

// NEXUM Intelligence Layer — capa educativa del terminal.
//
// El contenido vive en data/nexum-curriculum.json: cifras congeladas a una
// fecha, con los ejercicios calculados sobre esas mismas cifras. Es una
// decisión pedagógica, no una limitación: un ejercicio cuyo resultado cambia
// cada mañana no se puede corregir. El dato vivo se consulta aparte, contra
// /api/nexum/live, y se muestra como comparación — nunca reemplaza al
// snapshot mientras el alumno resuelve.

export type NexumUnit = "usd" | "pct" | "count" | "index";

export type NexumMetric = {
  id: string;
  label: string;
  value: number;
  unit: NexumUnit;
  deltaPct?: number | null;
  hint: string;
  /** tiene equivalente en /api/nexum/live */
  live?: boolean;
  /** cifra propietaria de Blockfinity: se marca en dorado */
  proprietary?: boolean;
  spark?: number[];
};

export type NexumPoint = { label: string; value: number };

export type NexumAnnotation = { at: number; text: string };

/** bars = ranking horizontal · area = serie temporal · donut = composición
 *  gauge = índice 0-100 · delta = rendimientos con signo, divergentes de cero */
export type NexumChartKind = "bars" | "area" | "donut" | "gauge" | "delta";

export type NexumChart = {
  id: string;
  kind: NexumChartKind;
  title: string;
  caption: string;
  unit: NexumUnit;
  proprietary?: boolean;
  data: NexumPoint[];
  annotations?: NexumAnnotation[];
};

export type NexumNodeKind = "input" | "process" | "chain" | "output";

export type NexumSchemeNode = {
  id: string;
  label: string;
  sub: string;
  kind: NexumNodeKind;
  col: number;
  row: number;
};

export type NexumSchemeEdge = { from: string; to: string; label?: string };

export type NexumScheme = {
  title: string;
  caption: string;
  nodes: NexumSchemeNode[];
  edges: NexumSchemeEdge[];
  legend: { kind: NexumNodeKind; label: string }[];
};

export type ComputeUnit = "pct" | "usd_t" | "usd_b" | "usd_m" | "num" | "x";

type ExerciseBase = { id: string; xp: number; prompt: string; hint: string; explain: string };

export type NexumExercise = ExerciseBase &
  (
    | { type: "quiz"; options: string[]; answer: number }
    /** igual que quiz, pero apunta a un gráfico del panorama */
    | { type: "read"; options: string[]; answer: number; chartRef?: string }
    /** `items` viene en el orden correcto; la UI los baraja */
    | { type: "order"; items: string[] }
    /** `pairs` viene emparejado; la UI baraja las definiciones */
    | { type: "match"; pairs: { term: string; def: string }[] }
    | {
        type: "compute";
        given: { label: string; value: string }[];
        answer: number;
        tolerance: number;
        unit: ComputeUnit;
      }
  );

export type NexumModule = {
  id: string;
  code: string;
  order: number;
  title: string;
  subtitle: string;
  vertical: string;
  /** ruta real del terminal que este módulo enseña a leer */
  href: string;
  stage: "dashboard" | "map";
  /** minutos estimados */
  duration: number;
  concept: { what: string; read: string; why: string };
  metrics: NexumMetric[];
  charts: NexumChart[];
  scheme: NexumScheme;
  glossary: { term: string; def: string }[];
  checkpoints: string[];
  exercises: NexumExercise[];
};

export type NexumLevel = { xp: number; title: string; note: string };

export type NexumCurriculum = {
  version: string;
  snapshotDate: string;
  snapshotLabel: string;
  snapshotNote: string;
  instructorPin: string;
  levels: NexumLevel[];
  modules: NexumModule[];
};

/* ---------- formato ---------- */

export function formatMetric(value: number, unit: NexumUnit): string {
  if (unit === "usd") return formatUsdCompact(value);
  if (unit === "pct") return `${value.toFixed(1)}%`;
  if (unit === "index") return value.toFixed(1).replace(/\.0$/, "");
  return value.toLocaleString("es-BO");
}

/** Etiqueta corta para el eje de un gráfico: sin decimales de más. */
export function formatAxis(value: number, unit: NexumUnit): string {
  if (unit === "usd") return formatUsdCompact(value);
  if (unit === "pct") return `${value % 1 === 0 ? value : value.toFixed(1)}%`;
  return value.toLocaleString("es-BO");
}

export const COMPUTE_SUFFIX: Record<ComputeUnit, string> = {
  pct: "%",
  usd_t: "billones de USD",
  usd_b: "miles de millones de USD",
  usd_m: "millones de USD",
  num: "",
  x: "×",
};

/* ---------- progreso ---------- */

export function totalXp(modules: NexumModule[]): number {
  return modules.reduce(
    (sum, m) => sum + m.exercises.reduce((s, e) => s + e.xp, 0),
    0
  );
}

export function moduleXp(module: NexumModule): number {
  return module.exercises.reduce((s, e) => s + e.xp, 0);
}

/** Nivel alcanzado y cuánto falta para el siguiente. */
export function levelFor(xp: number, levels: NexumLevel[]) {
  let current = levels[0];
  let next: NexumLevel | null = null;
  for (const level of levels) {
    if (xp >= level.xp) current = level;
    else {
      next = level;
      break;
    }
  }
  const span = next ? next.xp - current.xp : 1;
  const progress = next ? Math.min(1, (xp - current.xp) / span) : 1;
  return { current, next, progress };
}

/* ---------- corrección ---------- */

/** Acepta coma decimal, símbolos y espacios: el alumno escribe como habla. */
export function parseNumber(input: string): number | null {
  const cleaned = input
    .replace(/\s/g, "")
    .replace(/[$%×x]/gi, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function isComputeCorrect(input: string, answer: number, tolerance: number): boolean {
  const value = parseNumber(input);
  if (value === null) return false;
  return Math.abs(value - answer) <= tolerance;
}

/* ---------- barajado estable ---------- */

// Los ejercicios de ordenar y emparejar necesitan una mezcla que NO cambie
// entre renders (si no, arrastrar un elemento reordenaría la lista entera).
// Se deriva del id del ejercicio: misma semilla, misma mezcla, y distinta
// para cada ejercicio.
function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shuffleStable<T>(items: T[], seed: string): T[] {
  let state = seedFrom(seed) || 1;
  const next = () => {
    // xorshift32: suficiente para barajar cinco elementos
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // una mezcla que devuelve el orden original no enseña nada
  const unchanged = out.every((item, i) => item === items[i]);
  if (unchanged && out.length > 1) {
    [out[0], out[out.length - 1]] = [out[out.length - 1], out[0]];
  }
  return out;
}
