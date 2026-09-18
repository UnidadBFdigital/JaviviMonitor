// Paleta de visualización — instancia validada para la superficie oscura
// del terminal (#14171b). Verificada con el validador de la guía de dataviz:
// banda de luminosidad, piso de croma, separación CVD (protan/deutan),
// piso de visión normal y contraste ≥ 3:1. No editar valores a ojo.

// Slots categóricos en ORDEN FIJO. Se asignan en secuencia, nunca en ciclo:
// el color sigue a la entidad, no a su posición en un ranking filtrado.
export const CATEGORICAL = [
  "#3987e5", // 1 azul
  "#d95926", // 2 naranja
  "#199e70", // 3 aqua
  "#c98500", // 4 amarillo
  "#d55181", // 5 magenta
  "#008300", // 6 verde
  "#9085e9", // 7 violeta
  "#e66767", // 8 rojo
] as const;

// Scatter y bubble: cualquier par de marcas puede quedar contiguo, así que
// rige el chequeo all-pairs y solo los 3 primeros slots lo aprueban.
// Con más categorías, el excedente cae en "Otros".
export const SCATTER_SLOTS = 3;

export const NEUTRAL = "#64748b"; // "Otros" / sin categoría

// Dorado institucional. Identidad, no serie: marca lo propietario de
// Blockfinity (índices, tokenización, insights). Queda fuera de CATEGORICAL a
// propósito — si entrara como slot, competiría con el amarillo categórico.
export const GOLD = "#c9a227";
export const GOLD_BRIGHT = "#e0b64f";

// Status: significado reservado, nunca se usa como "serie 4".
export const STATUS = {
  up: "#16c784",
  down: "#ea3943",
  warn: "#f59e0b",
} as const;

// Cromos del tema (para ejes, grilla y tooltips de recharts)
export const CHART_THEME = {
  grid: "#262a2b",
  axis: "#64748b",
  ink: "#e8edf2",
  surface: "#14171b",
  raised: "#1a1e21",
} as const;

export const TOOLTIP_STYLE = {
  background: CHART_THEME.raised,
  border: `1px solid ${CHART_THEME.grid}`,
  borderRadius: 6,
  fontSize: 12,
  color: CHART_THEME.ink,
} as const;

/**
 * Asigna colores estables a un conjunto de claves: el orden de `keys`
 * define el slot y se mantiene aunque después se filtren series.
 * Más allá de `limit` slots, todo va a NEUTRAL ("Otros").
 */
export function colorMap(keys: string[], limit = CATEGORICAL.length): Map<string, string> {
  const map = new Map<string, string>();
  keys.forEach((k, i) => {
    map.set(k, i < limit ? CATEGORICAL[i] : NEUTRAL);
  });
  return map;
}

export function colorAt(index: number, limit = CATEGORICAL.length): string {
  return index < limit ? CATEGORICAL[index] : NEUTRAL;
}
