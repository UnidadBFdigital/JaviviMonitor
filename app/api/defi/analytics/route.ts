import { NextResponse } from "next/server";
import {
  getTopProtocols,
  getProtocolRevenue,
  getChainsTvl,
  getDexOverview,
} from "@/lib/sources/defillama";

// Datos para Protocol Analytics: bubble revenue vs TVL, treemap por chain.
export async function GET() {
  // Listas amplias: el bubble cruza ambos rankings por nombre y con top-30
  // de cada uno el solapamiento es mínimo.
  const [protocols, revenue, chains, dex] = await Promise.all([
    getTopProtocols(200),
    getProtocolRevenue(200),
    getChainsTvl(15),
    getDexOverview(),
  ]);
  return NextResponse.json({ protocols, revenue, chains, dex });
}
