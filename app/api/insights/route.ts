import { NextResponse } from "next/server";
import {
  getTvlHistory,
  getMovers,
  getProtocolRevenue,
  getRwaProtocols,
  getAllChainsTvl,
  getDexOverview,
} from "@/lib/sources/defillama";
import { getRwaDashboardMetrics } from "@/lib/sources/defillamaRwa";
import { getGlobalMarket } from "@/lib/sources/coingecko";
import { getFearGreed } from "@/lib/sources/feargreed";
import { getStablecoins, getStablecoinTotal } from "@/lib/sources/stablecoins";
import { buildSectors, UNCLASSIFIED } from "@/lib/rwaSectors";
import tokenizationJson from "@/data/tokenization.json";

// Morning Brief: hallazgos DERIVADOS de los datos del terminal, por reglas
// deterministas — sin IA generativa, así nunca inventa cifras. Cada línea
// nace de un dato con fuente. Objetivo: 8-10 señales por carga.

function pct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function usd(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

export async function GET() {
  const [tvl, movers, revenue, global, fng, stables, stableTotal, rwaDashboard, rwa, chains, dex] =
    await Promise.all([
      getTvlHistory(30),
      getMovers(5),
      getProtocolRevenue(5),
      getGlobalMarket(),
      getFearGreed(),
      getStablecoins(5),
      getStablecoinTotal(),
      getRwaDashboardMetrics(),
      getRwaProtocols(),
      getAllChainsTvl(),
      getDexOverview(),
    ]);

  const hallazgos: string[] = [];
  const riesgos: string[] = [];
  const oportunidades: string[] = [];
  let pregunta = "";

  // --- mercado agregado
  if (global.ok) {
    hallazgos.push(
      `Market cap total: ${usd(global.data.totalMarketCapUsd)}, ${pct(global.data.marketCapChange24hPct)} en 24h; dominancia BTC ${global.data.btcDominancePct.toFixed(1)}% (CoinGecko).`
    );
    if (global.data.btcDominancePct >= 60) {
      riesgos.push(
        `Dominancia BTC en ${global.data.btcDominancePct.toFixed(1)}%: rotación hacia el activo de refugio del sector, históricamente asociada a menor apetito por riesgo (CoinGecko).`
      );
    }
  }

  // --- TVL DeFi
  if (tvl.ok && tvl.data.length > 7) {
    const now = tvl.data[tvl.data.length - 1].tvlUsd;
    const week = tvl.data[tvl.data.length - 8].tvlUsd;
    const ch = ((now - week) / week) * 100;
    hallazgos.push(`TVL total en DeFi: ${usd(now)}, ${pct(ch)} en 7 días (DeFiLlama).`);
    if (ch < -5) riesgos.push(`Salida de capital DeFi: TVL ${pct(ch)} en la semana (DeFiLlama).`);
  }

  // --- tokenización: market cap de activos y TVL de protocolos son métricas separadas
  if (rwaDashboard.ok) {
    const metrics = rwaDashboard.data;
    hallazgos.push(
      `Mercado RWA: ${usd(metrics.onchainMcapUsd)} de Onchain AUM, ${usd(metrics.activeMcapUsd)} de Active AUM y ${usd(metrics.defiActiveTvlUsd)} de DeFi Active TVL${metrics.issuerCount !== null ? ` entre ${metrics.issuerCount} emisores` : ""} (DeFiLlama RWA).`
    );
  }

  if (rwa.ok && rwa.data.length > 0) {
    const { sectors, totalUsd } = buildSectors(
      rwa.data,
      tokenizationJson.sectorMap as Record<string, string[]>
    );
    const reales = sectors.filter((s) => s.name !== UNCLASSIFIED);
    hallazgos.push(
      `TVL de protocolos RWA: ${usd(totalUsd)} en ${rwa.data.length} protocolos, con ${reales[0]?.name ?? "—"} concentrando ${reales[0]?.sharePct.toFixed(1) ?? "—"}% (DeFiLlama /protocols).`
    );
    const top3 = rwa.data.slice(0, 3);
    if (top3.length === 3 && totalUsd > 0) {
      const share = (top3.reduce((s, p) => s + p.tvlUsd, 0) / totalUsd) * 100;
      if (share >= 30) {
        riesgos.push(
          `Concentración del TVL RWA: ${top3.map((p) => p.name).join(", ")} suman ${share.toFixed(1)}% del TVL de protocolos RWA (DeFiLlama).`
        );
      }
    }
    const creciendo = reales
      .filter((s) => s.change7dPct !== null && s.tvlUsd >= 100e6)
      .sort((a, b) => (b.change7dPct ?? 0) - (a.change7dPct ?? 0))[0];
    if (creciendo && (creciendo.change7dPct ?? 0) >= 1) {
      oportunidades.push(
        `${creciendo.name} crece ${pct(creciendo.change7dPct ?? 0)} en 7d dentro del TVL de protocolos RWA — candidato a nota de research (DeFiLlama).`
      );
    }
  }

  // --- concentración de infraestructura
  if (chains.ok && chains.data.length > 3) {
    const total = chains.data.reduce((s, c) => s + c.tvlUsd, 0);
    const top = [...chains.data].sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
    if (total > 0) {
      hallazgos.push(
        `${top.name} concentra ${((top.tvlUsd / total) * 100).toFixed(1)}% del TVL de todas las redes (DeFiLlama).`
      );
    }
  }

  // --- stablecoins
  if (stables.ok && stables.data.length >= 2) {
    const [a, b] = stables.data;
    // total del mercado, no la suma de los top 5
    const supply = stableTotal.ok ? stableTotal.data.totalUsd : null;
    hallazgos.push(
      supply !== null
        ? `Market cap oficial de stablecoins: ${usd(supply)}; ${a.symbol} ${usd(a.circulatingUsd)} vs ${b.symbol} ${usd(b.circulatingUsd)} (DeFiLlama).`
        : `${a.symbol} ${usd(a.circulatingUsd)} vs ${b.symbol} ${usd(b.circulatingUsd)} (DeFiLlama).`
    );
    const dom = stableTotal.ok ? stableTotal.data.dominancePct : null;
    const dominant = stableTotal.ok ? stableTotal.data.dominantSymbol ?? a.symbol : a.symbol;
    if (dom !== null && dom >= 60) {
      riesgos.push(
        `${dominant} concentra ${dom.toFixed(1)}% del market cap de stablecoins: riesgo de emisor único para cualquier tesis de dolarización digital (DeFiLlama).`
      );
    }
    oportunidades.push(
      `Variación semanal de ${a.symbol}: ${pct(a.change7dPct ?? 0)} — insumo directo para la tesis de dolarización digital en LATAM (DeFiLlama).`
    );
    pregunta = `¿Cómo se relaciona la variación semanal del supply de ${a.symbol} (${pct(a.change7dPct ?? 0)}) con la demanda de dólar digital en economías con restricción cambiaria?`;
  }

  // --- sentimiento
  if (fng.ok) {
    const v = fng.data.value;
    if (v >= 70) {
      riesgos.push(
        `Sentimiento en "${fng.data.classification}" (${v}/100): zona históricamente propensa a correcciones (Alternative.me).`
      );
    } else if (v <= 30) {
      oportunidades.push(
        `Sentimiento en "${fng.data.classification}" (${v}/100): niveles deprimidos suelen preceder recuperaciones — no es predicción (Alternative.me).`
      );
    } else {
      hallazgos.push(`Sentimiento neutro: Fear & Greed en ${v}/100 (Alternative.me).`);
    }
  }

  // --- revenue y movers
  if (revenue.ok && revenue.data.length > 0) {
    const top = revenue.data[0];
    hallazgos.push(
      `${top.name} lidera revenue con ${usd(top.revenue24hUsd)}/24h (DeFiLlama).`
    );
  }
  if (movers.ok && movers.data.gainers.length > 0) {
    const g = movers.data.gainers[0];
    oportunidades.push(
      `${g.name} (${g.category}) creció ${pct(g.change7dPct ?? 0)} de TVL en 7d (DeFiLlama).`
    );
    const l = movers.data.losers[0];
    if (l && (l.change7dPct ?? 0) < -10) {
      riesgos.push(`${l.name} perdió ${pct(l.change7dPct ?? 0)} de TVL en 7d (DeFiLlama).`);
    }
  }

  // --- actividad de intercambio
  if (dex.ok) {
    hallazgos.push(
      `Volumen DEX 24h: ${usd(dex.data.total24hUsd)}${
        dex.data.change7dPct !== null ? `, ${pct(dex.data.change7dPct)} 7d/7d` : ""
      } (DeFiLlama).`
    );
  }

  if (!pregunta) {
    pregunta = "¿Qué métrica del terminal mostró el cambio más anómalo esta semana y qué lo explica?";
  }

  return NextResponse.json({
    ok: true,
    // 10 señales. Stablecoins es pilar del producto y su línea se generaba
    // sexta, así que quedaba fuera con un tope de 5 hallazgos.
    hallazgos: hallazgos.slice(0, 6),
    riesgos: riesgos.slice(0, 2),
    oportunidades: oportunidades.slice(0, 2),
    pregunta,
    method: "Derivado por reglas de los datos del terminal — sin generación libre.",
    fetchedAt: new Date().toISOString(),
  });
}
