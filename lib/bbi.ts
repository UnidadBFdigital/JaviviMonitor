import type { ChainTvl } from "@/lib/sources/defillama";
import type { ChainStablecoinSupply } from "@/lib/sources/stablecoins";
import type { ChainActivityMetric } from "@/lib/sources/defillamaDashboard";
import { chainKey, observableNumber, scoreActivity, type ActivityComponent } from "./bbiMethodology";

// Blockfinity Blockchain Index (BBI). El documento del proyecto traía un
// scorecard de ejemplo cuyos totales no se derivaban de ninguna fórmula
// (solo uno de los cuatro cuadraba). Acá el índice se calcula siempre:
// BBI v2: seis categorías editoriales y un índice de actividad multidimensional.
// Las notas editoriales, métricas originales y aportes viajan con el resultado.

export type Weights = {
  seguridad: number;
  adopcion: number;
  actividadEconomica: number;
  escalabilidad: number;
  ecosistema: number;
  institucional: number;
  compliance: number;
};

export type CuratedScores = Omit<Weights, "actividadEconomica">;

export type Network = {
  name: string;
  llamaName: string | null;
  group: string;
  type: string;
  launchYear: number;
  consensus: string;
  traceability: string;
  privacy: string;
  monitoring: string;
  institutionalAdoption: string;
  regulatoryRisk: string;
  mainUseCases: string;
  ecosystemMaturity: string;
  scores: CuratedScores;
  note: string;
  /** por qué la red queda fuera de la capa 2; null si sí tiene TVL */
  tvlExcludedReason: string | null;
  review?: { reviewedAt: string; rationale: string; sources: { label: string; url: string }[] };
  referenceMetrics?: { label: string; valueUsd: number; period: string; publishedAt: string; source: string; url: string; note: string }[];
};

export type ScoredNetwork = Network & {
  /** TVL en vivo; null cuando la red no publica uno (permissioned) */
  tvlUsd: number | null;
  /** null = sin dato; cero solo cuando la fuente publica cero */
  stablecoinSupplyUsd: number | null;
  /** Suma bruta de stocks que pueden solaparse. No entra sumada en el BBI. */
  economicFootprintUsd: number | null;
  /** Índice 0-10 de cinco métricas observables; null con cobertura insuficiente. */
  actividadEconomica: number | null;
  activeAddresses24h: number | null;
  dexVolume24hUsd: number | null;
  chainFees24hUsd: number | null;
  activityCoverage: number;
  activityComponents: ActivityComponent[];
  institutionalScore: number;
  contributions: { key: keyof Weights; score: number | null; weight: number; effectiveWeight: number; points: number }[];
  comparable: boolean;
  /** índice ponderado 0-10 */
  bbi: number;
  /** true si falta alguna métrica de actividad o no aplica a la red */
  bbiPartial: boolean;
};

/** Encaje institucional editorial: misma fórmula que publica el scorecard. */
export function institutionalScoreOf(scores: CuratedScores): number {
  return scores.institucional * 0.5 + scores.compliance * 0.3 + scores.seguridad * 0.2;
}

export function scoreNetworks(
  networks: Network[],
  chains: ChainTvl[],
  weights: Weights,
  stablecoinSupply: ChainStablecoinSupply[] = [],
  activity: ChainActivityMetric[] = []
): ScoredNetwork[] {
  const tvlByChain = new Map<string, number>();
  for (const c of chains) { const value = observableNumber(c.tvlUsd); if (value !== null) tvlByChain.set(chainKey(c.name), value); }
  const stablecoinsByChain = new Map<string, number>();
  for (const c of stablecoinSupply) {
    const value = observableNumber(c.circulatingUsd);
    if (value !== null) stablecoinsByChain.set(chainKey(c.chain), value);
  }
  const activityByChain = new Map(activity.map(row => [chainKey(row.name), row]));

  return networks
    .map((n) => {
      const key = chainKey(n.llamaName ?? n.name);
      const observed = n.llamaName ? activityByChain.get(key) : undefined;
      const tvlUsd = n.llamaName ? (tvlByChain.get(key) ?? observableNumber(observed?.tvlUsd)) : null;
      const stablecoinSupplyUsd = n.llamaName
        ? (stablecoinsByChain.get(key) ?? observableNumber(observed?.stablecoinMcapUsd))
        : null;
      const economicFootprintUsd = tvlUsd !== null || stablecoinSupplyUsd !== null ? (tvlUsd ?? 0) + (stablecoinSupplyUsd ?? 0) : null;
      const activeAddresses24h = observableNumber(observed?.activeAddresses24h);
      const dexVolume24hUsd = observableNumber(observed?.dexVolume24hUsd);
      const chainFees24hUsd = observableNumber(observed?.chainFees24hUsd);
      const measured = scoreActivity({ tvlUsd, stablecoinSupplyUsd, activeAddresses24h, dexVolume24hUsd, chainFees24hUsd });
      const actividadEconomica = measured.score;

      // Sin capa 2 se reparte su peso entre las demás en vez de puntuar cero:
      // una red permissioned no tiene TVL bajo, no tiene TVL a secas.
      const parts = (Object.keys(weights) as (keyof Weights)[]).map(key => ({
        key, score: key === "actividadEconomica" ? actividadEconomica : n.scores[key], weight: weights[key],
      }));
      const totalWeight = parts.reduce((sum, p) => sum + (p.score !== null ? p.weight : 0), 0);
      const contributions = parts.map(p => ({ ...p,
        effectiveWeight: p.score !== null && totalWeight > 0 ? p.weight / totalWeight * 100 : 0,
        points: p.score !== null && totalWeight > 0 ? p.score * p.weight / totalWeight : 0,
      }));
      const bbi = contributions.reduce((sum, p) => sum + p.points, 0);

      return {
        ...n,
        tvlUsd,
        stablecoinSupplyUsd,
        economicFootprintUsd,
        actividadEconomica,
        activeAddresses24h,
        dexVolume24hUsd,
        chainFees24hUsd,
        activityCoverage: measured.coverage,
        activityComponents: measured.components,
        institutionalScore: institutionalScoreOf(n.scores),
        contributions,
        comparable: n.llamaName !== null && actividadEconomica !== null && measured.complete,
        bbi,
        bbiPartial: !measured.complete,
      };
    })
    .sort((a, b) => Number(b.comparable) - Number(a.comparable) || b.bbi - a.bbi || a.name.localeCompare(b.name));
}

export type UseCaseRecommendation = {
  useCase: "Pagos" | "Tokenización" | "Compliance";
  leader: string;
  score: number;
  rationale: string;
  alternatives: string[];
};

/** Rankings transparentes y específicos; no sustituyen el diagnóstico por cliente. */
export function buildUseCaseRecommendations(scored: ScoredNetwork[]): UseCaseRecommendation[] {
  if (scored.length === 0) return [];
  const rank = (
    useCase: UseCaseRecommendation["useCase"],
    metric: (network: ScoredNetwork) => number,
    rationale: (network: ScoredNetwork) => string
  ): UseCaseRecommendation | null => {
    const ordered = scored
      .filter(n => useCase !== "Pagos" || (n.comparable && n.stablecoinSupplyUsd !== null && n.stablecoinSupplyUsd > 0))
      .map((network) => ({ network, value: metric(network) }))
      .sort((a, b) => b.value - a.value);
    const winner = ordered[0];
    if (!winner) return null;
    return {
      useCase,
      leader: winner.network.name,
      score: winner.value,
      rationale: rationale(winner.network),
      alternatives: ordered.slice(1, 3).map(({ network }) => network.name),
    };
  };

  return [
    rank(
      "Pagos",
      (n) => (n.activityComponents.find(c => c.key === "stablecoinSupplyUsd")?.score ?? 0) * 0.4 +
        (n.activityComponents.find(c => c.key === "activeAddresses24h")?.score ?? 0) * 0.3 +
        n.scores.escalabilidad * 0.2 + n.scores.compliance * 0.1,
      (n) => `40% oferta de stablecoins, 30% direcciones activas, 20% escalabilidad y 10% monitoreo. ${usd(n.stablecoinSupplyUsd ?? 0)} en stablecoins; no mide transferencias de pagos.`
    ),
    rank(
      "Tokenización",
      (n) => n.scores.institucional * 0.35 + n.scores.compliance * 0.2 +
        n.scores.seguridad * 0.2 + n.scores.ecosistema * 0.15 + n.scores.escalabilidad * 0.1,
      (n) => `Prioriza compatibilidad institucional ${n.scores.institucional}/10, compliance ${n.scores.compliance}/10 y seguridad ${n.scores.seguridad}/10.`
    ),
    rank(
      "Compliance",
      (n) => n.scores.compliance * 0.45 + n.scores.seguridad * 0.3 +
        n.scores.institucional * 0.2 + n.scores.adopcion * 0.05,
      (n) => `Prioriza monitoreo y compliance ${n.scores.compliance}/10, seguridad ${n.scores.seguridad}/10 y encaje institucional ${n.scores.institucional}/10.`
    ),
  ].filter((item): item is UseCaseRecommendation => item !== null);
}

function usd(v: number): string {
  return v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : `$${(v / 1e6).toFixed(0)}M`;
}

export function buildBbiInsights(scored: ScoredNetwork[]): string[] {
  const out: string[] = [];
  if (scored.length === 0) return out;

  const [first, second] = scored.filter(n => n.comparable);
  if (first) out.push(`${first.name} lidera el BBI comparable con ${first.bbi.toFixed(2)}/10${second ? `, seguida de ${second.name} (${second.bbi.toFixed(2)})` : ""}. El puesto combina actividad observable y criterio editorial.`);
  else out.push("No hay cobertura completa para publicar un podio BBI comparable. Las notas parciales se presentan aparte.");
  const active = [...scored].filter(n => n.activeAddresses24h !== null).sort((a, b) => (b.activeAddresses24h ?? 0) - (a.activeAddresses24h ?? 0))[0];
  if (active) out.push(`${active.name} lidera las direcciones activas de las redes monitoreadas: ${new Intl.NumberFormat("es-BO").format(active.activeAddresses24h!)} en 24h. Son direcciones, no personas únicas.`);

  // concentración de TVL: el argumento de "dónde está la actividad real"
  const withTvl = scored.filter((n) => n.tvlUsd !== null) as (ScoredNetwork & { tvlUsd: number })[];
  if (withTvl.length >= 3) {
    const total = withTvl.reduce((s, n) => s + n.tvlUsd, 0);
    const top = [...withTvl].sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
    if (total > 0) out.push(
      `${top.name} concentra ${((top.tvlUsd / total) * 100).toFixed(1)}% del TVL de las redes monitoreadas (${usd(top.tvlUsd)} de ${usd(total)}).`
    );
  }

  // la tensión central del BBIM: volumen alto con aceptación institucional baja
  const brecha = scored
    .filter((n) => n.scores.adopcion >= 8 && n.scores.institucional <= 4)
    .sort((a, b) => b.scores.adopcion - a.scores.adopcion)[0];
  if (brecha) {
    out.push(
      `${brecha.name}: adopción editorial ${brecha.scores.adopcion}/10 y encaje institucional ${brecha.scores.institucional}/10. Son dimensiones distintas; estas notas no determinan autorización regulatoria ni volumen de pagos.`
    );
  }

  // el caso inverso: listas para instituciones pero sin masa crítica
  const institucional = scored
    .filter((n) => n.scores.institucional >= 9 && n.scores.adopcion <= 4)
    .map((n) => n.name);
  if (institucional.length > 0) {
    const plural = institucional.length > 1;
    out.push(
      `${institucional.join(", ")} ${plural ? "puntúan" : "puntúa"} alto en encaje institucional editorial y bajo en adopción editorial. Comparar redes privadas y públicas exige revisar cobertura y caso de uso.`
    );
  }

  const sinTvl = scored.filter((n) => n.bbiPartial);
  if (sinTvl.length > 0) {
    out.push(
      `${sinTvl.length} redes tienen datos incompletos o no comparables. Se muestran aparte del podio; los datos ausentes no se sustituyen por cero.`
    );
  }

  return out;
}
