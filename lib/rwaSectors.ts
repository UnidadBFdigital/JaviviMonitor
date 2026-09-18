import type { ProtocolTvl } from "@/lib/sources/defillama";

// Agrega los protocolos RWA de DeFiLlama en sectores de negocio y deriva
// lecturas por reglas — mismo criterio que /api/insights: nada se genera
// libremente, cada frase sale de una cifra.

export const UNCLASSIFIED = "Sin clasificar";
/** DeFiLlama ya separa el crédito privado on-chain en su propia categoría. */
const LENDING_CATEGORY = "RWA Lending";
const LENDING_SECTOR = "Crédito privado";

export type RwaSector = {
  name: string;
  tvlUsd: number;
  sharePct: number;
  /** variación 7d ponderada por TVL, reconstruida desde el cambio de cada protocolo */
  change7dPct: number | null;
  protocols: number;
  /** los tres mayores del sector, para dar contexto sin abrir la tabla */
  top: string[];
};

/** Índice inverso nombre-de-protocolo → sector, desde el mapa curado. */
function reverseIndex(sectorMap: Record<string, string[]>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [sector, names] of Object.entries(sectorMap)) {
    for (const name of names) index.set(name.toLowerCase(), sector);
  }
  return index;
}

function sectorOf(p: ProtocolTvl, index: Map<string, string>): string {
  const mapped = index.get(p.name.toLowerCase());
  if (mapped) return mapped;
  if (p.category === LENDING_CATEGORY) return LENDING_SECTOR;
  return UNCLASSIFIED;
}

/** TVL de hace 7 días implícito en el cambio semanal que reporta la fuente. */
function tvlPrev(p: ProtocolTvl): number {
  if (p.change7dPct === null || p.change7dPct <= -100) return p.tvlUsd;
  return p.tvlUsd / (1 + p.change7dPct / 100);
}

/**
 * Protocolos agrupados por sector. Es la única regla de clasificación: la usan
 * las tarjetas de sectores y el histórico por sector, así una barra y su serie
 * nunca cuentan protocolos distintos.
 */
export function classifyProtocols(
  protocols: ProtocolTvl[],
  sectorMap: Record<string, string[]>
): Map<string, ProtocolTvl[]> {
  const index = reverseIndex(sectorMap);
  const buckets = new Map<string, ProtocolTvl[]>();
  for (const p of protocols) {
    const sector = sectorOf(p, index);
    const bucket = buckets.get(sector);
    if (bucket) bucket.push(p);
    else buckets.set(sector, [p]);
  }
  return buckets;
}

export function buildSectors(
  protocols: ProtocolTvl[],
  sectorMap: Record<string, string[]>
): { sectors: RwaSector[]; totalUsd: number } {
  const buckets = classifyProtocols(protocols, sectorMap);

  const totalUsd = protocols.reduce((s, p) => s + p.tvlUsd, 0);

  const sectors: RwaSector[] = [...buckets.entries()].map(([name, list]) => {
    const tvlUsd = list.reduce((s, p) => s + p.tvlUsd, 0);
    const prev = list.reduce((s, p) => s + tvlPrev(p), 0);
    const sorted = [...list].sort((a, b) => b.tvlUsd - a.tvlUsd);
    return {
      name,
      tvlUsd,
      sharePct: totalUsd > 0 ? (tvlUsd / totalUsd) * 100 : 0,
      change7dPct: prev > 0 ? ((tvlUsd - prev) / prev) * 100 : null,
      protocols: list.length,
      top: sorted.slice(0, 3).map((p) => p.name),
    };
  });

  // "Sin clasificar" siempre al final aunque pese mucho: es residuo, no sector.
  sectors.sort((a, b) => {
    if (a.name === UNCLASSIFIED) return 1;
    if (b.name === UNCLASSIFIED) return -1;
    return b.tvlUsd - a.tvlUsd;
  });

  return { sectors, totalUsd };
}

function usd(v: number): string {
  return v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : `$${(v / 1e6).toFixed(0)}M`;
}

function pct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function buildRwaInsights(
  sectors: RwaSector[],
  protocols: ProtocolTvl[],
  totalUsd: number
): string[] {
  const out: string[] = [];
  const real = sectors.filter((s) => s.name !== UNCLASSIFIED);
  if (real.length === 0 || totalUsd <= 0) return out;

  const [first, second] = real;
  out.push(
    `${first.name} concentra ${first.sharePct.toFixed(1)}% del TVL de protocolos RWA (${usd(first.tvlUsd)} en ${first.protocols} protocolos).`
  );

  if (second) {
    out.push(
      `El segundo sector es ${second.name} con ${usd(second.tvlUsd)} (${second.sharePct.toFixed(1)}%) — liderado por ${second.top[0]}.`
    );
  }

  // concentración por emisor: cuánto pesan los tres mayores protocolos
  const top3 = protocols.slice(0, 3);
  if (top3.length === 3) {
    const share = (top3.reduce((s, p) => s + p.tvlUsd, 0) / totalUsd) * 100;
    out.push(
      `Concentración alta: ${top3.map((p) => p.name).join(", ")} suman ${share.toFixed(1)}% del TVL de protocolos RWA.`
    );
  }

  // sector que más se movió en la semana, solo si el movimiento es material
  const movers = real.filter((s) => s.change7dPct !== null && s.tvlUsd >= 100e6);
  if (movers.length > 0) {
    const fastest = movers.reduce((a, b) =>
      Math.abs(b.change7dPct!) > Math.abs(a.change7dPct!) ? b : a
    );
    if (Math.abs(fastest.change7dPct!) >= 1) {
      out.push(
        `${fastest.name} es el sector que más se movió en 7 días: ${pct(fastest.change7dPct!)} de TVL.`
      );
    }
  }

  const unclassified = sectors.find((s) => s.name === UNCLASSIFIED);
  if (unclassified && unclassified.sharePct >= 3) {
    out.push(
      `${unclassified.sharePct.toFixed(1)}% (${usd(unclassified.tvlUsd)}) sigue sin clasificar en ${unclassified.protocols} protocolos — ampliar el mapa de sectores mejora la lectura.`
    );
  }

  return out;
}
