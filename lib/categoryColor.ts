import { CATEGORICAL, NEUTRAL } from "@/lib/palette";

// Color estable por categoría de protocolo: la asignación depende del nombre
// de la categoría, no de su posición en un ranking, así el color de "Lending"
// es el mismo en todas las tablas y no cambia al filtrar.
const ORDER = [
  "Lending",
  "Dexs",
  "Liquid Staking",
  "Bridge",
  "Restaking",
  "Staking Pool",
  "CDP",
  "Yield",
];

export function categoryColor(category: string): string {
  const i = ORDER.indexOf(category);
  return i >= 0 ? CATEGORICAL[i] : NEUTRAL;
}
