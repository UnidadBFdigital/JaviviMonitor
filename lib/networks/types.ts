// Esquema interno común del módulo de infraestructura. Un solo contrato para
// todas las vistas: los componentes de React nunca hablan con un proveedor.
//
// Regla dura: un dato que la fuente no publica es `null`, nunca 0, y viaja
// con el motivo en `unavailable`. Cero significa "la fuente publicó cero".

export type Layer = "L1" | "L2";
export type VmFamily = "EVM" | "zkEVM" | "SVM" | "Move VM" | "WASM" | "TVM";

/** Cadencia real de cada bloque de datos. No se escribe "LIVE" a algo diario. */
export type Freshness = "LIVE" | "HOURLY" | "DAILY" | "MONTHLY" | "STATIC";

export type Provenance = {
  block: string;
  source: string;
  url: string;
  fetchedAt: string | null;
  freshness: Freshness;
  period: string;
  ok: boolean;
  stale: boolean;
  note?: string;
};

export type SeriesPoint = { date: string; value: number };

export type NetworkTooling = {
  evm: boolean;
  foundry: boolean;
  hardhat: boolean;
  remix: boolean;
  accountAbstraction: string;
  oracles: string[];
  indexers: string[];
  wallets: string[];
  sdks: string[];
};

export type NetworkRegistryEntry = {
  id: string;
  name: string;
  layer: Layer;
  kind: string;
  vm: VmFamily;
  language: string;
  settlesOn: string | null;
  gasToken: string;
  launched: number;
  blockTimeSec: number | null;
  finalitySec: number | null;
  finalityNote: string;
  feeModel: string;
  docs: string;
  faucet: string | null;
  grants: string | null;
  repo: string;
  repoNote?: string;
  keys: { llama: string | null; growthepie: string | null; l2beat: string | null; bbi: string | null };
  tooling: NetworkTooling;
};

export type CostBlock = {
  /** costo mediano por transacción, USD */
  medianUsd: number | null;
  avg7dUsd: number | null;
  avg30dUsd: number | null;
  min30dUsd: number | null;
  max30dUsd: number | null;
  /** coeficiente de variación a 30 días: estabilidad del costo */
  volatility30d: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  change90dPct: number | null;
  unavailable: string | null;
};

export type ActivityBlock = {
  activeAddresses24h: number | null;
  dailyActiveAddresses: number | null;
  txCount24h: number | null;
  observedTps: number | null;
  throughputGasPerSec: number | null;
  daaChange7dPct: number | null;
  daaChange30dPct: number | null;
  daaChange90dPct: number | null;
  txChange7dPct: number | null;
  txChange30dPct: number | null;
  txChange90dPct: number | null;
  unavailable: string | null;
};

export type LiquidityBlock = {
  tvlUsd: number | null;
  tvlChange7dPct: number | null;
  tvlChange30dPct: number | null;
  tvlChange90dPct: number | null;
  stablecoinUsd: number | null;
  dexVolume24hUsd: number | null;
  dexVolume7dUsd: number | null;
  chainFees24hUsd: number | null;
  protocols: number | null;
};

export type RwaBlock = {
  protocolCount: number | null;
  tvlUsd: number | null;
  note: string;
};

export type DevBlock = {
  repo: string;
  repoNote: string | null;
  commits4w: number | null;
  commits12w: number | null;
  commits52w: number | null;
  commitsPrev12w: number | null;
  commitsChangePct: number | null;
  stars: number | null;
  contributors: number | null;
  pushedAt: string | null;
  /** Electric Capital no publica API: la columna existe y se declara vacía */
  ecosystemDevelopers: number | null;
  ecosystemDevelopersSource: string;
  unavailable: string | null;
};

export type ArchBlock = {
  stage: string | null;
  category: string | null;
  dataAvailability: string | null;
  providers: string[];
  risks: { name: string; value: string; sentiment: string; description: string }[];
  blockTimeSec: number | null;
  finalitySec: number | null;
  /** 0-10 */
  securityScore: number | null;
  securityBasis: string | null;
  /** encaje institucional editorial del BBI, reutilizado tal cual */
  institutionalScore: number | null;
};

export type NetworkMetrics = NetworkRegistryEntry & {
  cost: CostBlock;
  activity: ActivityBlock;
  liquidity: LiquidityBlock;
  rwa: RwaBlock;
  dev: DevBlock;
  arch: ArchBlock;
  history: { cost: SeriesPoint[]; daa: SeriesPoint[]; tvl: SeriesPoint[]; commits: SeriesPoint[] };
  explorers: { label: string; url: string }[];
  rpcs: { label: string; url: string }[];
  sources: Provenance[];
};
