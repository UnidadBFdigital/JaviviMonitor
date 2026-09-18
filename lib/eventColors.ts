import { CATEGORICAL, NEUTRAL } from "@/lib/palette";

// Color por categoría de evento regulatorio. Vive en un solo lugar para que
// el timeline y la lista del gráfico del dólar coincidan.
//
// Nota: dentro del área de plot del gráfico los eventos NO se pintan con
// estos colores — ahí compartirían canal con las series de precio y el mismo
// color significaría dos cosas. Las marcas sobre la línea usan un único color
// de anotación; estos colores solo identifican la categoría en texto.
const MAP: Record<string, string> = {
  Cambiario: CATEGORICAL[0],
  BCB: CATEGORICAL[1],
  ASFI: CATEGORICAL[2],
  UIF: CATEGORICAL[3],
  PSAV: CATEGORICAL[4],
  Normativa: CATEGORICAL[5],
};

export function eventColor(category: string): string {
  return MAP[category] ?? NEUTRAL;
}

/** Color de las marcas de evento sobre el plot (canal de anotación). */
export const ANNOTATION = "#8e9ba5";
