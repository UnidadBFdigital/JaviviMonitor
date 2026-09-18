import { NextResponse } from "next/server";
import { buildNetworks, REGISTRY_META } from "@/lib/networks/build";
import { INDEX_VERSION } from "@/lib/networks/score";

// Build & Cost Intelligence — un único endpoint con el universo normalizado.
//
// El scoring NO se hace acá: viaja el dato crudo y el cliente puntúa con el
// perfil elegido (lib/networks/score.ts es TypeScript puro). Así cambiar de
// caso de uso no dispara una petición y los pesos quedan auditables en el
// mismo módulo que la interfaz muestra en metodología.
//
// La degradación es parcial por diseño: si una fuente cae, sus campos quedan
// en null con motivo y el resto del tablero sigue en pie.
export async function GET() {
  const { networks, sources, failed, generatedAt } = await buildNetworks();

  return NextResponse.json({
    generatedAt,
    indexVersion: INDEX_VERSION,
    registry: REGISTRY_META,
    universe: networks.length,
    failed,
    sources,
    networks,
  });
}
