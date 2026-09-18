export const BBI_VERSION = "2.0 · 07/09/2026";

export type ActivityKey = "activeAddresses24h" | "stablecoinSupplyUsd" | "tvlUsd" | "dexVolume24hUsd" | "chainFees24hUsd";
export type ActivityValues = Record<ActivityKey, number | null>;

// Anclas editoriales fijas: añadir o quitar una red no cambia las notas del resto.
// Cada dimensión se normaliza por separado; nunca se suman stocks con flujos.
export const ACTIVITY_METRICS: { key: ActivityKey; label: string; weight: number; floor: number; ceiling: number; unit: "usd" | "count"; definition: string }[] = [
  { key: "activeAddresses24h", label: "Direcciones activas · 24h", weight: 30, floor: 1_000, ceiling: 5_000_000, unit: "count", definition: "Direcciones con actividad según la fuente. Incluye automatización; no equivale a personas únicas." },
  { key: "stablecoinSupplyUsd", label: "Oferta de stablecoins", weight: 25, floor: 10e6, ceiling: 150e9, unit: "usd", definition: "Stock monetario en la red. No mide pagos ni volumen de transferencias." },
  { key: "tvlUsd", label: "TVL DeFi", weight: 20, floor: 10e6, ceiling: 50e9, unit: "usd", definition: "Capital depositado en protocolos DeFi. Puede incluir stablecoins; se puntúa por separado." },
  { key: "dexVolume24hUsd", label: "Volumen DEX · 24h", weight: 15, floor: 1e6, ceiling: 5e9, unit: "usd", definition: "Intercambios spot en DEX. No es volumen total de pagos ni transferencias de stablecoins." },
  { key: "chainFees24hUsd", label: "Comisiones de red · 24h", weight: 10, floor: 1_000, ceiling: 5e6, unit: "usd", definition: "Comisiones agregadas por uso de la red. Reflejan demanda y precio; no son costo medio por transacción." },
];

export type ActivityComponent = (typeof ACTIVITY_METRICS)[number] & { value: number | null; score: number | null };

export function observableNumber(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function metricScore(value: number | null, floor: number, ceiling: number): number | null {
  const n = observableNumber(value);
  if (n === null) return null;
  if (n === 0) return 0;
  return Math.max(1, Math.min(10, 1 + 9 * Math.log(n / floor) / Math.log(ceiling / floor)));
}

export function scoreActivity(values: ActivityValues) {
  const components = ACTIVITY_METRICS.map(m => ({ ...m, value: observableNumber(values[m.key]), score: metricScore(values[m.key], m.floor, m.ceiling) }));
  const present = components.filter(m => m.score !== null);
  const coverage = present.reduce((sum, m) => sum + m.weight, 0);
  // Un único indicador no habilita un índice de uso compuesto.
  const score = present.length >= 3 && coverage >= 60
    ? present.reduce((sum, m) => sum + m.score! * m.weight, 0) / coverage
    : null;
  return { score, coverage, components, complete: coverage === 100 };
}

export function chainKey(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ({ bnbchain: "bsc", binancesmartchain: "bsc", polygonpos: "polygon", xrpledger: "xrpl", ripple: "xrpl", optimism: "opmainnet", nearprotocol: "near" } as Record<string, string>)[key] ?? key;
}
