import { NextResponse } from "next/server";
import { getNewsByCategory } from "@/lib/sources/news";

// El tracker de jurisdicciones es un dataset curado que la página lee directo
// del JSON; acá solo va lo que sí es live: la cobertura de prensa clasificada
// como CBDC y como Regulación por el motor de News B2B.
export async function GET() {
  const [cbdc, regulacion] = await Promise.all([
    getNewsByCategory("CBDC", 8),
    getNewsByCategory("Regulación", 10),
  ]);
  return NextResponse.json({ cbdc, regulacion });
}
