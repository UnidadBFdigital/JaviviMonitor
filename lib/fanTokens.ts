import type { FanToken } from "@/lib/sources/coingecko";

// Agrupa fan tokens por competencia con el mapa curado y deriva lecturas por
// reglas. Mismo criterio que lib/rwaSectors: lo no mapeado se muestra como
// "Sin clasificar", nunca se reparte.

export const UNCLASSIFIED = "Sin clasificar";

export type League = {
  name: string;
  marketCapUsd: number;
  volume24hUsd: number;
  sharePct: number;
  change7dPct: number | null;
  tokens: number;
  top: string[];
};

function reverseIndex(leagueMap: Record<string, string[]>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [league, symbols] of Object.entries(leagueMap)) {
    for (const s of symbols) index.set(s.toUpperCase(), league);
  }
  return index;
}

function capPrev(t: FanToken): number {
  if (t.change7dPct === null || t.change7dPct <= -100) return t.marketCapUsd;
  return t.marketCapUsd / (1 + t.change7dPct / 100);
}

export function buildLeagues(
  tokens: FanToken[],
  leagueMap: Record<string, string[]>
): { leagues: League[]; totalMarketCapUsd: number; totalVolume24hUsd: number } {
  const index = reverseIndex(leagueMap);
  const buckets = new Map<string, FanToken[]>();

  for (const t of tokens) {
    const league = index.get(t.symbol) ?? UNCLASSIFIED;
    const bucket = buckets.get(league);
    if (bucket) bucket.push(t);
    else buckets.set(league, [t]);
  }

  const totalMarketCapUsd = tokens.reduce((s, t) => s + t.marketCapUsd, 0);
  const totalVolume24hUsd = tokens.reduce((s, t) => s + t.volume24hUsd, 0);

  const leagues: League[] = [...buckets.entries()].map(([name, list]) => {
    const marketCapUsd = list.reduce((s, t) => s + t.marketCapUsd, 0);
    const prev = list.reduce((s, t) => s + capPrev(t), 0);
    const sorted = [...list].sort((a, b) => b.marketCapUsd - a.marketCapUsd);
    return {
      name,
      marketCapUsd,
      volume24hUsd: list.reduce((s, t) => s + t.volume24hUsd, 0),
      sharePct: totalMarketCapUsd > 0 ? (marketCapUsd / totalMarketCapUsd) * 100 : 0,
      change7dPct: prev > 0 ? ((marketCapUsd - prev) / prev) * 100 : null,
      tokens: list.length,
      top: sorted.slice(0, 3).map((t) => t.symbol),
    };
  });

  leagues.sort((a, b) => {
    if (a.name === UNCLASSIFIED) return 1;
    if (b.name === UNCLASSIFIED) return -1;
    return b.marketCapUsd - a.marketCapUsd;
  });

  return { leagues, totalMarketCapUsd, totalVolume24hUsd };
}

function usd(v: number): string {
  return v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : `$${(v / 1e6).toFixed(1)}M`;
}

function pct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function buildFanInsights(
  leagues: League[],
  tokens: FanToken[],
  totalMarketCapUsd: number,
  totalVolume24hUsd: number
): string[] {
  const out: string[] = [];
  const real = leagues.filter((l) => l.name !== UNCLASSIFIED);
  if (real.length === 0 || tokens.length === 0) return out;

  out.push(
    `El mercado de fan tokens capitaliza ${usd(totalMarketCapUsd)} en ${tokens.length} activos — escala de nicho frente a cualquier vertical RWA.`
  );

  const [first] = real;
  out.push(
    `${first.name} lidera con ${usd(first.marketCapUsd)} (${first.sharePct.toFixed(1)}%) en ${first.tokens} tokens.`
  );

  // liquidez: cuánto rota el mercado en un día respecto de su capitalización
  if (totalMarketCapUsd > 0) {
    const turnover = (totalVolume24hUsd / totalMarketCapUsd) * 100;
    out.push(
      `Rotación diaria de ${turnover.toFixed(1)}% del market cap (${usd(totalVolume24hUsd)} en 24h): ${
        turnover >= 10 ? "liquidez alta para el tamaño del mercado" : "liquidez concentrada en pocos nombres"
      }.`
    );
  }

  const byVolume = [...tokens].sort((a, b) => b.volume24hUsd - a.volume24hUsd);
  const topVol = byVolume[0];
  if (topVol && totalVolume24hUsd > 0) {
    out.push(
      `${topVol.symbol} concentra ${((topVol.volume24hUsd / totalVolume24hUsd) * 100).toFixed(1)}% del volumen del día (${usd(topVol.volume24hUsd)}).`
    );
  }

  const movers = real.filter((l) => l.change7dPct !== null && l.marketCapUsd >= 1e6);
  if (movers.length > 0) {
    const fastest = movers.reduce((a, b) =>
      Math.abs(b.change7dPct!) > Math.abs(a.change7dPct!) ? b : a
    );
    if (Math.abs(fastest.change7dPct!) >= 1) {
      out.push(`${fastest.name} es la competencia que más se movió en 7 días: ${pct(fastest.change7dPct!)}.`);
    }
  }

  return out;
}
