import { NextResponse } from "next/server";
import { FRESH, jsonCached, withCache } from "@/lib/httpCache";
import { getNewsByCategory } from "@/lib/sources/news";

// Radar institucional de la portada: cinco frentes que un ejecutivo del
// ecosistema financiero necesita mirar todos los días. Las cuatro primeras
// categorías las clasifica el motor de News B2B; "Riesgos" se arma con las
// que ya trae marcadas y se filtra por señales de incidente en el titular.
export async function GET() {
  const [stablecoins, tokenizacion, regulacion, bancos, todo] = await Promise.all([
    getNewsByCategory("Stablecoins", 6),
    getNewsByCategory("RWA / Tokenización", 6),
    getNewsByCategory("Regulación", 6),
    getNewsByCategory("Banca", 6),
    getNewsByCategory("Regulación", 40),
  ]);

  // señales de incidente: hackeos, exploits, quiebras, sanciones, demandas
  const RIESGO =
    /\b(hack|exploit|breach|stolen|robo|drain|insolven|bankrupt|quiebra|fraud|sanction|sanci|lawsuit|demanda|charge|indict|collapse|depeg|freeze|congel)/i;

  const riesgos = todo.ok ? todo.data.filter((h) => RIESGO.test(h.title)).slice(0, 6) : [];

  return withCache(NextResponse.json({
    stablecoins,
    tokenizacion,
    regulacion,
    bancos,
    riesgos: todo.ok
      ? { ok: true as const, data: riesgos, source: todo.source, fetchedAt: todo.fetchedAt, stale: todo.stale }
      : todo,
  }), FRESH.minutes30);
}
