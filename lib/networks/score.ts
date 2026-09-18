import type { NetworkMetrics } from "./types";
import { activeAddresses, feesPerActiveUser } from "./series";

// Builder Score — índice propietario de Blockfinity para decidir dónde construir.
//
// Reglas que lo hacen auditable, no una nota arbitraria:
//  1. Cada componente declara su definición, dirección (más alto mejor o
//     peor), la fuente que lo alimenta y a qué redes cubre.
//  2. La normalización es winsorización 5%/95% + escala min-max sobre
//     logaritmo donde la magnitud es multiplicativa. Un outlier no aplasta
//     al resto. La referencia es el registro completo; ampliarlo puede cambiar notas.
//  3. Un dato ausente NO puntúa cero: se renormalizan los pesos del pilar y
//     se publica la cobertura. Con menos de la mitad del pilar cubierto, el
//     pilar queda en null.
//  4. Los pesos viven en esta configuración, no dentro de los componentes.
//  5. Solo entran a los pilares componentes que existen para TODO el universo.
//     La versión 1 puntuaba costo y rendimiento con series que solo cubren
//     Ethereum y sus L2: siete L1 quedaban con pilares vacíos y el ranking
//     comparaba redes medidas con varas distintas. Lo parcial sigue publicado
//     como detalle, nunca dentro de la nota.

export const INDEX_NAME = "Builder Score";
export const INDEX_VERSION = "2.0 · 14/09/2026";

/* ---------- componentes ---------- */

export type ComponentId =
  | "feesPerUser"
  | "cost"
  | "costStability"
  | "throughput"
  | "tps"
  | "blockTime"
  | "finality"
  | "activeAddresses"
  | "txCount"
  | "tvl"
  | "stablecoins"
  | "dexVolume"
  | "protocols"
  | "rwaTvl"
  | "devCommits"
  | "devMomentum"
  | "tooling"
  | "evmCompat"
  | "oracles"
  | "security";

export type PillarId = "economic" | "developer" | "adoption" | "capital" | "security";

/** A qué redes llega el dato: decide si el componente puede entrar al índice. */
export type ComponentCoverage = "universal" | "evm" | "partial";

type ComponentSpec = {
  id: ComponentId;
  label: string;
  definition: string;
  source: string;
  coverage: ComponentCoverage;
  /** true = más alto es mejor */
  higherIsBetter: boolean;
  /** escala logarítmica: magnitudes que se comparan por orden, no por resta */
  log: boolean;
  get: (network: NetworkMetrics) => number | null;
};

export const COVERAGE_LABEL: Record<ComponentCoverage, string> = {
  universal: "Todas las redes",
  evm: "Solo Ethereum y L2 (growthepie)",
  partial: "Parcial (registro curado)",
};

/** Completitud del stack de desarrollo, 0-10, contada sobre hechos del registro. */
export function toolingScore(network: NetworkMetrics): number {
  const t = network.tooling;
  let score = 0;
  if (t.foundry) score += 1.5;
  if (t.hardhat) score += 1.5;
  if (t.remix) score += 0.5;
  if (network.faucet) score += 1;
  if (network.grants) score += 0.5;
  if (t.accountAbstraction && !/^no/i.test(t.accountAbstraction)) score += 1;
  score += Math.min(1.5, t.oracles.length * 0.5);
  score += Math.min(1.5, t.indexers.length * 0.5);
  score += Math.min(1, t.sdks.length * 0.34);
  // las cadenas no-EVM tienen su propio stack: se acredita por SDK y wallets
  if (!t.evm) score += Math.min(1, t.wallets.length * 0.34);
  return Math.min(10, score);
}

export const COMPONENTS: ComponentSpec[] = [
  {
    id: "feesPerUser",
    label: "Comisiones por usuario activo",
    definition:
      "Comisiones de red de 24h divididas por las direcciones activas del día. Aproxima cuánto gasta en comisiones un usuario activo en un día; no es el costo de una transacción ni de un despliegue.",
    source: "DeFiLlama · growthepie",
    coverage: "universal",
    higherIsBetter: false,
    log: true,
    get: (n) => feesPerActiveUser(n).value,
  },
  {
    id: "cost",
    label: "Costo mediano por transacción",
    definition: "Mediana en USD de lo que paga una transacción del día. No es el costo de un swap ni de un despliegue.",
    source: "growthepie",
    coverage: "evm",
    higherIsBetter: false,
    log: true,
    get: (n) => n.cost.medianUsd,
  },
  {
    id: "costStability",
    label: "Estabilidad del costo",
    definition: "Coeficiente de variación del costo mediano a 30 días. Menor es mejor: presupuestar exige previsibilidad.",
    source: "growthepie",
    coverage: "evm",
    higherIsBetter: false,
    log: false,
    get: (n) => n.cost.volatility30d,
  },
  {
    id: "throughput",
    label: "Throughput observado",
    definition: "Gas por segundo efectivamente consumido. Es capacidad observada, nunca el TPS teórico del proyecto.",
    source: "growthepie",
    coverage: "evm",
    higherIsBetter: true,
    log: true,
    get: (n) => n.activity.throughputGasPerSec,
  },
  {
    id: "tps",
    label: "Transacciones por segundo observadas",
    definition: "Transacciones diarias divididas por 86.400. Medición, no capacidad máxima declarada.",
    source: "growthepie",
    coverage: "evm",
    higherIsBetter: true,
    log: true,
    get: (n) => n.activity.observedTps,
  },
  {
    id: "blockTime",
    label: "Tiempo de bloque",
    definition: "Parámetro de protocolo documentado por cada red.",
    source: "Registro curado",
    coverage: "partial",
    higherIsBetter: false,
    log: true,
    get: (n) => n.arch.blockTimeSec,
  },
  {
    id: "finality",
    label: "Finalidad",
    definition: "Segundos hasta finalidad económica. Solo donde la red publica un valor verificable.",
    source: "Registro curado",
    coverage: "partial",
    higherIsBetter: false,
    log: true,
    get: (n) => n.arch.finalitySec,
  },
  {
    id: "activeAddresses",
    label: "Direcciones activas · 24h",
    definition: "Direcciones que interactuaron con la red en el corte. Incluye automatización; no equivale a personas únicas.",
    source: "DeFiLlama · growthepie",
    coverage: "universal",
    higherIsBetter: true,
    log: true,
    get: (n) => activeAddresses(n).value,
  },
  {
    id: "txCount",
    label: "Transacciones diarias",
    definition: "Transacciones liquidadas en el último día publicado.",
    source: "growthepie",
    coverage: "evm",
    higherIsBetter: true,
    log: true,
    get: (n) => n.activity.txCount24h,
  },
  {
    id: "tvl",
    label: "TVL",
    definition: "Capital depositado en los protocolos DeFi de la red.",
    source: "DeFiLlama",
    coverage: "universal",
    higherIsBetter: true,
    log: true,
    get: (n) => n.liquidity.tvlUsd,
  },
  {
    id: "stablecoins",
    label: "Liquidez en stablecoins",
    definition: "Oferta de stablecoins en circulación en la red. Es el dinero con el que se liquida.",
    source: "DeFiLlama",
    coverage: "universal",
    higherIsBetter: true,
    log: true,
    get: (n) => n.liquidity.stablecoinUsd,
  },
  {
    id: "dexVolume",
    label: "Volumen DEX · 24h",
    definition: "Intercambios spot en exchanges descentralizados de la red.",
    source: "DeFiLlama",
    coverage: "universal",
    higherIsBetter: true,
    log: true,
    get: (n) => n.liquidity.dexVolume24hUsd,
  },
  {
    id: "protocols",
    label: "Protocolos activos",
    definition: "Protocolos DeFi con TVL rastreado en la red.",
    source: "DeFiLlama",
    coverage: "universal",
    higherIsBetter: true,
    log: true,
    get: (n) => n.liquidity.protocols,
  },
  {
    id: "rwaTvl",
    label: "TVL de RWA",
    definition: "Capital de protocolos de activos del mundo real atribuidos a la red como cadena principal.",
    source: "DeFiLlama",
    coverage: "universal",
    higherIsBetter: true,
    log: true,
    get: (n) => n.rwa.tvlUsd,
  },
  {
    id: "devCommits",
    label: "Commits del repositorio núcleo · 12 semanas",
    definition: "Actividad del cliente o monorepo principal. NO es el número de desarrolladores del ecosistema.",
    source: "GitHub",
    coverage: "universal",
    higherIsBetter: true,
    log: true,
    get: (n) => n.dev.commits12w,
  },
  {
    id: "devMomentum",
    label: "Variación de commits",
    definition: "Últimas 12 semanas contra las 12 anteriores, en el repositorio núcleo.",
    source: "GitHub",
    coverage: "universal",
    higherIsBetter: true,
    log: false,
    get: (n) => n.dev.commitsChangePct,
  },
  {
    id: "tooling",
    label: "Completitud del stack de desarrollo",
    definition: "Foundry, Hardhat, Remix, faucet, grants, abstracción de cuentas, oráculos, indexadores y SDK presentes.",
    source: "Registro curado",
    coverage: "universal",
    higherIsBetter: true,
    log: false,
    get: (n) => toolingScore(n),
  },
  {
    id: "evmCompat",
    label: "Portabilidad EVM",
    definition: "Mide costo de migración, no calidad: una red no-EVM puede tener mejor tooling propio y aun así exigir reescribir el contrato.",
    source: "Registro curado",
    coverage: "universal",
    higherIsBetter: true,
    log: false,
    get: (n) => (n.tooling.evm ? 10 : 2.5),
  },
  {
    id: "oracles",
    label: "Proveedores de oráculo",
    definition: "Oráculos de precio con despliegue verificado en la red.",
    source: "Registro curado",
    coverage: "universal",
    higherIsBetter: true,
    log: false,
    get: (n) => n.tooling.oracles.length,
  },
  {
    id: "security",
    label: "Seguridad",
    definition: "En L2, stage y riesgos publicados por L2BEAT. En L1, la nota editorial del BBI de Blockfinity. La base se muestra por red.",
    source: "L2BEAT · BBI",
    coverage: "universal",
    higherIsBetter: true,
    log: false,
    get: (n) => n.arch.securityScore,
  },
];

const COMPONENT_BY_ID = new Map(COMPONENTS.map((c) => [c.id, c]));

/* ---------- pilares ---------- */

// `short` existe para encabezados de tabla: dos pilares empezaban con la
// misma palabra y recortar la etiqueta los volvía indistinguibles.
export const PILLARS: { id: PillarId; label: string; short: string; weight: number; components: Partial<Record<ComponentId, number>> }[] = [
  {
    id: "economic",
    short: "Costo",
    label: "Costo de uso",
    weight: 25,
    components: { feesPerUser: 100 },
  },
  {
    id: "developer",
    short: "Desarrollo",
    label: "Facilidad para desarrollar",
    weight: 25,
    components: { tooling: 35, evmCompat: 25, devCommits: 25, devMomentum: 15 },
  },
  {
    id: "adoption",
    short: "Uso",
    label: "Uso real",
    weight: 20,
    components: { activeAddresses: 50, dexVolume: 25, protocols: 25 },
  },
  {
    id: "capital",
    short: "Capital",
    label: "Capital y liquidez",
    weight: 20,
    components: { tvl: 45, stablecoins: 55 },
  },
  {
    id: "security",
    short: "Seguridad",
    label: "Seguridad",
    weight: 10,
    components: { security: 100 },
  },
];

/* ---------- perfiles por caso de uso ---------- */

export type ProfileId = "general" | "mvp" | "payments" | "defi" | "rwa" | "consumer";

export type Profile = {
  id: ProfileId;
  label: string;
  question: string;
  pillars: Record<PillarId, number>;
  /** multiplicador sobre el peso del componente dentro de su pilar */
  emphasis: Partial<Record<ComponentId, number>>;
};

export const PROFILES: Profile[] = [
  {
    id: "general",
    label: "General",
    question: "¿Qué red ofrece hoy el mejor equilibrio para construir?",
    pillars: { economic: 25, developer: 25, adoption: 20, capital: 20, security: 10 },
    emphasis: {},
  },
  {
    id: "mvp",
    label: "MVP rápido",
    question: "¿Dónde lanzo rápido y barato una primera versión?",
    pillars: { economic: 30, developer: 45, adoption: 10, capital: 10, security: 5 },
    emphasis: { tooling: 2, evmCompat: 1.5 },
  },
  {
    id: "payments",
    label: "Pagos",
    question: "¿Dónde mover dólar digital con usuarios reales y comisiones bajas?",
    pillars: { economic: 35, developer: 10, adoption: 25, capital: 25, security: 5 },
    emphasis: { stablecoins: 2.5, activeAddresses: 1.5 },
  },
  {
    id: "defi",
    label: "DeFi",
    question: "¿Dónde hay capital y mercados para construir DeFi?",
    pillars: { economic: 15, developer: 20, adoption: 25, capital: 30, security: 10 },
    emphasis: { tvl: 2, dexVolume: 2, protocols: 1.5 },
  },
  {
    id: "rwa",
    label: "Tokenización · RWA",
    question: "¿Dónde emitir un activo real con liquidez en dólares y seguridad?",
    pillars: { economic: 10, developer: 15, adoption: 15, capital: 30, security: 30 },
    emphasis: { stablecoins: 2 },
  },
  {
    id: "consumer",
    label: "App de consumo",
    question: "¿Dónde ya hay usuarios y el costo no expulsa a nadie?",
    pillars: { economic: 30, developer: 20, adoption: 35, capital: 10, security: 5 },
    emphasis: { activeAddresses: 2, tooling: 1.5 },
  },
];

export const PROFILE_BY_ID = new Map(PROFILES.map((p) => [p.id, p]));

/* ---------- normalización ---------- */

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (pos - low);
}

/**
 * Winsorización al 5%/95% y escala min-max, en logaritmo cuando la magnitud
 * es multiplicativa. Devuelve 0-100 con la dirección ya aplicada.
 */
export function normalizeComponent(values: (number | null)[], spec: ComponentSpec): (number | null)[] {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length < 2) return values.map((v) => (v === null || !Number.isFinite(v) ? null : 50));

  const transform = (v: number) => (spec.log ? Math.log10(Math.max(v, 1e-6)) : v);
  const transformed = present.map(transform).sort((a, b) => a - b);
  const low = quantile(transformed, 0.05);
  const high = quantile(transformed, 0.95);
  const span = high - low;

  return values.map((v) => {
    if (v === null || !Number.isFinite(v)) return null;
    if (span === 0) return 50;
    const clamped = Math.max(low, Math.min(high, transform(v)));
    const scaled = ((clamped - low) / span) * 100;
    return spec.higherIsBetter ? scaled : 100 - scaled;
  });
}

/* ---------- puntuación ---------- */

export type ScoredComponent = {
  id: ComponentId;
  label: string;
  raw: number | null;
  normalized: number | null;
  weight: number;
  source: string;
  definition: string;
};

export type ScoredPillar = {
  id: PillarId;
  label: string;
  score: number | null;
  weight: number;
  coverage: number;
  components: ScoredComponent[];
};

export type ScoredNetworkResult = {
  id: string;
  score: number | null;
  coverage: number;
  pillars: ScoredPillar[];
  /** los tres componentes que más aportan al puntaje, con su cifra real */
  drivers: { id: ComponentId; label: string; normalized: number; raw: number | null }[];
  /** el componente peor puntuado con dato disponible */
  drag: { id: ComponentId; label: string; normalized: number; raw: number | null } | null;
};

/**
 * Puntúa el universo completo con un perfil. La normalización es relativa al
 * universo evaluado: agregar una red cambia las notas y por eso el universo
 * se declara siempre en la interfaz.
 */
export function scoreUniverse(
  networks: NetworkMetrics[],
  profileId: ProfileId = "general"
): Map<string, ScoredNetworkResult> {
  const profile = PROFILE_BY_ID.get(profileId) ?? PROFILES[0];

  const normalized = new Map<ComponentId, (number | null)[]>();
  const raws = new Map<ComponentId, (number | null)[]>();
  for (const spec of COMPONENTS) {
    const values = networks.map((n) => spec.get(n));
    raws.set(spec.id, values);
    normalized.set(spec.id, normalizeComponent(values, spec));
  }

  const out = new Map<string, ScoredNetworkResult>();

  networks.forEach((network, index) => {
    const pillars: ScoredPillar[] = PILLARS.map((pillar) => {
      const components: ScoredComponent[] = Object.entries(pillar.components).map(([id, weight]) => {
        const componentId = id as ComponentId;
        const spec = COMPONENT_BY_ID.get(componentId)!;
        const emphasis = profile.emphasis[componentId] ?? 1;
        return {
          id: componentId,
          label: spec.label,
          raw: raws.get(componentId)![index],
          normalized: normalized.get(componentId)![index],
          weight: (weight ?? 0) * emphasis,
          source: spec.source,
          definition: spec.definition,
        };
      });

      const available = components.filter((c) => c.normalized !== null);
      const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
      const availableWeight = available.reduce((sum, c) => sum + c.weight, 0);
      const coverage = totalWeight > 0 ? (availableWeight / totalWeight) * 100 : 0;
      // menos de la mitad del pilar cubierto no es un pilar: es una conjetura
      const score =
        coverage >= 50 && availableWeight > 0
          ? available.reduce((sum, c) => sum + c.normalized! * c.weight, 0) / availableWeight
          : null;

      return {
        id: pillar.id,
        label: pillar.label,
        score,
        weight: profile.pillars[pillar.id],
        coverage,
        components,
      };
    });

    const scored = pillars.filter((p) => p.score !== null);
    const weight = scored.reduce((sum, p) => sum + p.weight, 0);
    const observedWeight = pillars.reduce((sum, p) => sum + p.weight * p.coverage / 100, 0);
    const eligible = scored.length >= 3 && observedWeight >= 60;
    const score = eligible && weight > 0 ? scored.reduce((sum, p) => sum + p.score! * p.weight, 0) / weight : null;
    const totalWeight = PILLARS.reduce((sum, p) => sum + profile.pillars[p.id], 0);

    const flat = pillars
      .filter((p) => p.score !== null)
      .flatMap((p) => {
        const componentWeight = p.components.filter((c) => c.normalized !== null).reduce((sum, c) => sum + c.weight, 0);
        return p.components.map((c) => ({ ...c, pillarWeight: componentWeight > 0 ? p.weight / componentWeight : 0 }));
      })
      .filter((c) => c.normalized !== null && c.weight > 0);
    const ranked = [...flat].sort(
      (a, b) => b.normalized! * b.weight * b.pillarWeight - a.normalized! * a.weight * a.pillarWeight
    );
    const worst = [...flat].sort((a, b) => a.normalized! - b.normalized!)[0];

    out.set(network.id, {
      id: network.id,
      score,
      coverage: totalWeight > 0 ? (observedWeight / totalWeight) * 100 : 0,
      pillars,
      drivers: ranked.slice(0, 3).map((c) => ({ id: c.id, label: c.label, normalized: c.normalized!, raw: c.raw })),
      drag: worst ? { id: worst.id, label: worst.label, normalized: worst.normalized!, raw: worst.raw } : null,
    });
  });

  return out;
}

/* ---------- momentum ---------- */

export type TrendSignal = "Acelerando" | "Creciendo" | "Estable" | "Enfriándose" | "Retrocediendo";

export type Momentum = {
  id: string;
  /** puntaje ajustado por tamaño: controla el efecto base */
  score: number | null;
  /** crecimiento sin ajustar, para mostrar la cifra real */
  rawGrowthPct: number | null;
  /** 0-1: cuánto pesa la red frente a la mediana del universo */
  sizeFactor: number;
  signal: TrendSignal | null;
  /** componentes publicados; los de detalle no entran al compuesto */
  parts: { label: string; changePct: number | null; inComposite: boolean }[];
  emerging: boolean;
};

export type MomentumWindow = 7 | 30 | 90;

/** Peso de los commits en el compuesto: el repositorio acompaña, no define. */
const DEV_SHARE = 0.15;

/**
 * Momentum con control de efecto base. El compuesto usa solo lo que existe
 * para todas las redes —la tendencia del TVL, con un 15% de commits— para que
 * dos redes siempre se comparen con la misma medida. Las direcciones activas
 * diarias existen solo en Ethereum y sus L2: se publican como detalle, fuera
 * de la cifra.
 *
 * El crecimiento se multiplica por size/(size + mediana), que vale 0,5 en la
 * mediana y tiende a 1 en las grandes. Las chicas con crecimiento alto se
 * publican aparte, como emergentes, en vez de esconderlas.
 */
export function computeMomentum(
  networks: NetworkMetrics[],
  window: MomentumWindow = 30
): Map<string, Momentum> {
  const sizes = networks
    .map((n) => n.liquidity.tvlUsd ?? n.liquidity.stablecoinUsd ?? null)
    .filter((v): v is number => v !== null && v > 0)
    .sort((a, b) => a - b);
  const medianSize = sizes.length > 0 ? quantile(sizes, 0.5) : 0;

  const out = new Map<string, Momentum>();

  for (const network of networks) {
    const tvl =
      window === 7 ? network.liquidity.tvlChange7dPct
      : window === 90 ? network.liquidity.tvlChange90dPct
      : network.liquidity.tvlChange30dPct;
    const daa =
      window === 7 ? network.activity.daaChange7dPct
      : window === 90 ? network.activity.daaChange90dPct
      : network.activity.daaChange30dPct;
    const commits = network.dev.commitsChangePct;

    // sin tendencia de la red no hay momentum, aunque el repositorio se mueva
    const blend = (networkSide: number | null): number | null => {
      if (networkSide === null) return null;
      return commits === null ? networkSide : networkSide * (1 - DEV_SHARE) + commits * DEV_SHARE;
    };

    const rawGrowthPct = blend(tvl);
    // la señal se clasifica contra la MISMA medida a 7 días, para que el chip
    // no pueda contradecir a la cifra publicada
    const shortGrowthPct = blend(network.liquidity.tvlChange7dPct);

    const size = network.liquidity.tvlUsd ?? network.liquidity.stablecoinUsd ?? 0;
    const sizeFactor = medianSize > 0 ? size / (size + medianSize) : 0;

    let signal: TrendSignal | null = null;
    if (rawGrowthPct !== null) {
      if (rawGrowthPct > 2 && shortGrowthPct !== null && shortGrowthPct > rawGrowthPct) signal = "Acelerando";
      else if (rawGrowthPct > 2) signal = "Creciendo";
      else if (rawGrowthPct < -2 && shortGrowthPct !== null && shortGrowthPct <= rawGrowthPct) signal = "Retrocediendo";
      else if (rawGrowthPct < -2) signal = "Enfriándose";
      else signal = "Estable";
    }

    const parts: Momentum["parts"] = [
      { label: `TVL ${window}d`, changePct: tvl, inComposite: true },
      { label: "Commits 12s", changePct: commits, inComposite: true },
    ];
    if (daa !== null) parts.push({ label: `Direcciones activas ${window}d · solo EVM`, changePct: daa, inComposite: false });

    out.set(network.id, {
      id: network.id,
      score: rawGrowthPct === null ? null : rawGrowthPct * sizeFactor,
      rawGrowthPct,
      sizeFactor,
      signal,
      parts,
      emerging: rawGrowthPct !== null && rawGrowthPct > 15 && sizeFactor < 0.5,
    });
  }

  return out;
}

/* ---------- señales de research ---------- */

export type ResearchSignal = {
  id: string;
  network: string;
  data: { label: string; value: string; direction: "up" | "down" | "flat" }[];
  signal: string;
  interpretation: string;
};

function arrow(change: number | null): "up" | "down" | "flat" {
  if (change === null) return "flat";
  if (change > 2) return "up";
  if (change < -2) return "down";
  return "flat";
}

function pct(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

/**
 * DATO → SEÑAL → INTERPRETACIÓN, derivado solo de las cifras calculadas.
 * Sin modelo de lenguaje: las mismas entradas producen siempre el mismo texto.
 * Un indicador que la red no publica no aparece: la señal nunca muestra huecos.
 */
export function buildResearchSignals(
  networks: NetworkMetrics[],
  momentum: Map<string, Momentum>,
  window: MomentumWindow = 30,
  limit = 4
): ResearchSignal[] {
  const ranked = [...networks]
    .filter((n) => momentum.get(n.id)?.score !== null && momentum.get(n.id)?.score !== undefined)
    .sort((a, b) => Math.abs(momentum.get(b.id)!.score!) - Math.abs(momentum.get(a.id)!.score!))
    .slice(0, limit);

  return ranked.map((network) => {
    const m = momentum.get(network.id)!;
    const costChange =
      window === 7 ? network.cost.change7dPct
      : window === 90 ? network.cost.change90dPct
      : network.cost.change30dPct;
    const daaChange =
      window === 7 ? network.activity.daaChange7dPct
      : window === 90 ? network.activity.daaChange90dPct
      : network.activity.daaChange30dPct;
    const tvlChange =
      window === 7 ? network.liquidity.tvlChange7dPct
      : window === 90 ? network.liquidity.tvlChange90dPct
      : network.liquidity.tvlChange30dPct;

    const candidates: { label: string; change: number | null; invert?: boolean }[] = [
      { label: `TVL ${window}d`, change: tvlChange },
      { label: "Commits 12s", change: network.dev.commitsChangePct },
      { label: `Direcciones activas ${window}d`, change: daaChange },
      // en costo, bajar es la buena noticia: la flecha se invierte
      { label: `Costo mediano ${window}d`, change: costChange, invert: true },
    ];
    const data = candidates.flatMap(({ label, change, invert }) =>
      change === null
        ? []
        : [{ label, value: pct(change), direction: arrow(invert ? -change : change) }]
    );

    const ups = data.filter((d) => d.direction === "up").length;
    const downs = data.filter((d) => d.direction === "down").length;
    const signal =
      m.signal === null
        ? "Sin serie suficiente para clasificar la tendencia."
        : `${m.signal}${m.emerging ? " · base chica" : ""}. ${ups} de ${data.length} indicadores al alza${downs > 0 ? `, ${downs} a la baja` : ""}.`;

    const pieces: string[] = [];
    if (costChange !== null && costChange < -5) pieces.push("el costo de usarla bajó");
    if (costChange !== null && costChange > 5) pieces.push("usarla se encareció");
    if ((daaChange ?? 0) > 5) pieces.push("entran más direcciones");
    if ((daaChange ?? 0) < -5) pieces.push("se retiran direcciones");
    if ((tvlChange ?? 0) > 5) pieces.push("entra capital");
    if ((tvlChange ?? 0) < -5) pieces.push("sale capital");
    if ((network.dev.commitsChangePct ?? 0) > 15) pieces.push("el repositorio núcleo acelera");

    const interpretation =
      pieces.length === 0
        ? "Sin movimientos relevantes en el período: la red se mantiene donde estaba."
        : `${pieces.join(", ").replace(/^./, (c) => c.toUpperCase())}${
            m.emerging ? ". El tamaño relativo es chico, así que el porcentaje exagera el efecto" : ""
          }.`;

    return { id: network.id, network: network.name, data, signal, interpretation };
  });
}
