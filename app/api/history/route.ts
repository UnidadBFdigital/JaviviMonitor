import { NextResponse, type NextRequest } from "next/server";
import { resolveHistory } from "@/lib/history";
import { HISTORY_KINDS, type HistoryKind } from "@/lib/historyTypes";

// Histórico a demanda para la ficha lateral. Un solo endpoint para todas las
// entidades del terminal: la ficha pide {kind, id} y recibe siempre la misma
// forma. Las fallas de la fuente viajan con ok:false y HTTP 200 para que la
// ficha pueda mostrar el motivo; solo un pedido mal formado es un 400.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind");
  const id = params.get("id")?.trim() ?? "";
  const label = (params.get("label") ?? id).trim().slice(0, 80);

  if (!kind || !HISTORY_KINDS.includes(kind as HistoryKind) || id.length === 0 || id.length > 120) {
    return NextResponse.json({ error: "Parámetros inválidos: kind e id son obligatorios." }, { status: 400 });
  }

  const payload = await resolveHistory({ kind: kind as HistoryKind, id, label: label || id });
  return NextResponse.json(payload);
}
