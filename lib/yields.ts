// DeFi Yields: traduce los pools de DeFiLlama Yields a preguntas que entiende
// cualquiera —qué hago con mi dinero, cuánto rinde, hasta cuándo y qué riesgo
// asumo— con funciones puras que se prueban sin red.
//
// Reglas del módulo:
//  1. Ningún rendimiento se estima: APY, TVL y cambios salen tal cual de la fuente.
//  2. Plazos y características solo se leen de lo que la fuente publica
//     (metadatos del pool). Si no hay plazo informado, no se inventa uno.
//  3. Las señales de riesgo son reglas visibles, no una calificación: cada
//     señal dice qué dato la dispara. No auditan contratos.

/* ---------- tipos de operación ---------- */

export type OperationId = "lend" | "stake" | "restake" | "dollar" | "rwa" | "liquidity" | "fixed" | "vault" | "other";

export const OPERATIONS: { id: OperationId; label: string; description: string }[] = [
  {
    id: "lend",
    label: "Prestar",
    description: "Depositás un activo en un mercado de préstamos y cobrás el interés que pagan quienes lo piden prestado.",
  },
  {
    id: "stake",
    label: "Staking",
    description: "Delegás tokens para asegurar una red y recibís parte de sus recompensas. En staking líquido te dan un token que podés seguir usando.",
  },
  {
    id: "restake",
    label: "Restaking",
    description: "Reutilizás activos que ya están en staking para asegurar otros servicios, a cambio de un extra y de una capa más de riesgo.",
  },
  {
    id: "dollar",
    label: "Ahorro en dólares",
    description: "Stablecoins que rinden por sí mismas: tasas de ahorro, estrategias con cobertura o préstamos colateralizados.",
  },
  {
    id: "rwa",
    label: "Tesoros y RWA",
    description: "Tokens respaldados por activos reales, como letras del Tesoro o crédito privado. Suelen pedir verificación de identidad.",
  },
  {
    id: "liquidity",
    label: "Proveer liquidez",
    description: "Aportás activos a un exchange descentralizado y cobrás comisiones. Si los precios se separan, sufrís pérdida impermanente.",
  },
  {
    id: "fixed",
    label: "Tasa fija",
    description: "Asegurás un rendimiento conocido hasta una fecha de vencimiento. Salir antes es vender al precio del momento.",
  },
  {
    id: "vault",
    label: "Vaults y estrategias",
    description: "Un contrato o un gestor mueve tu depósito entre protocolos para optimizar el rendimiento. Sumás el riesgo de la estrategia.",
  },
  {
    id: "other",
    label: "Otros",
    description: "Incentivos, seguros y productos que no encajan en las categorías anteriores.",
  },
];

export const OPERATION_BY_ID = new Map(OPERATIONS.map((o) => [o.id, o]));

const LEND_CATEGORIES = new Set(["Lending", "Uncollateralized Lending", "Risk Curators"]);
const STAKE_CATEGORIES = new Set(["Liquid Staking", "Staking Pool", "Chain", "Farm"]);
const RESTAKE_CATEGORIES = new Set(["Liquid Restaking", "Restaking", "Restaked BTC", "Collateral Markets"]);
const LIQUIDITY_CATEGORIES = new Set(["Dexs", "Liquidity Manager", "Cross Chain Bridge", "DEX Aggregator"]);
const DOLLAR_CATEGORIES = new Set(["Basis Trading", "CDP", "Yield", "Algo-Stables", "Dual-Token Stablecoin", "Stablecoin Wrapper", "Synthetics", "DOR"]);
const VAULT_CATEGORIES = new Set([
  "Yield",
  "Yield Aggregator",
  "Onchain Capital Allocator",
  "Leveraged Farming",
  "Indexes",
  "Basis Trading",
  "Derivatives",
  "Synthetics",
  "DOR",
  "Options Vault",
]);

export type ClassifyInput = {
  category: string | null;
  poolMeta: string | null;
  exposure: string | null;
  ilRisk: boolean;
  stablecoin: boolean;
};

/**
 * Qué operación representa un pool. El orden importa: una tasa fija de Pendle
 * vive en la categoría "Yield" y un LP con vencimiento también; primero se
 * miran los metadatos, después la forma del depósito y al final la categoría.
 */
export function classifyOperation(input: ClassifyInput): OperationId {
  const meta = input.poolMeta ?? "";
  const category = input.category ?? "";
  // "Fixed Borrow Rate" describe al que pide prestado, no al que deposita
  if (!/fixed borrow/i.test(meta) && /for buying pt|\bPT-|fixed yield|fixed mat|fixed-rate|fixed rate|fixed pool/i.test(meta)) {
    return "fixed";
  }
  if (/for lp/i.test(meta) || input.exposure === "multi" || input.ilRisk || LIQUIDITY_CATEGORIES.has(category)) return "liquidity";
  if (LEND_CATEGORIES.has(category)) return "lend";
  if (STAKE_CATEGORIES.has(category)) return "stake";
  if (RESTAKE_CATEGORIES.has(category)) return "restake";
  if (category === "RWA") return "rwa";
  if (input.stablecoin && DOLLAR_CATEGORIES.has(category)) return "dollar";
  if (VAULT_CATEGORIES.has(category)) return "vault";
  return "other";
}

/* ---------- plazos y características ---------- */

export type TermKind = "maturity" | "exit" | "lock" | "fixedBorrow" | "fee";

export type Term = {
  kind: TermKind;
  label: string;
  /** días de espera o de bloqueo, cuando la fuente los informa */
  days: number | null;
  /** fecha de vencimiento ISO, cuando la hay */
  date: string | null;
};

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
};
const MONTH_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function isoDate(year: number, month: number, day: number): string | null {
  if (!month || day < 1 || day > 31 || year < 2000) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTH_ES[month - 1]} ${year}`;
}

function maturityOf(meta: string): string | null {
  const compact = meta.match(/(?:Maturity\s+|PT-[\w.]+-)(\d{1,2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEPT|SEP|OCT|NOV|DEC)(\d{4})/i);
  if (compact) return isoDate(Number(compact[3]), MONTHS[compact[2].toUpperCase()], Number(compact[1]));
  const long = meta.match(/Maturity\s+\w{3}\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*\s+(\d{1,2})\s+(\d{4})/i);
  if (long) return isoDate(Number(long[3]), MONTHS[long[1].toUpperCase()], Number(long[2]));
  const iso = meta.match(/Fixed mat:\s*(\d{4})-(\d{2})-(\d{2})/i);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return null;
}

const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

function toDays(amount: string, unit: string): number {
  const key = unit.toLowerCase().replace(/s$/, "");
  return Math.round(Number(amount) * (UNIT_DAYS[key] ?? 1) * 10) / 10;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Plazos que publica la fuente: vencimiento, espera para retirar, bloqueo,
 * tasa de préstamo fija y comisión por época. Un pool sin metadatos no tiene
 * plazo informado, que no es lo mismo que no tener plazo.
 */
export function parseTerms(poolMeta: string | null): Term[] {
  const meta = poolMeta ?? "";
  if (!meta) return [];
  const terms: Term[] = [];

  const maturity = maturityOf(meta);
  if (maturity) terms.push({ kind: "maturity", label: `Vence el ${formatShortDate(maturity)}`, days: null, date: maturity });

  const term = meta.match(/(\d+)\s*month term/i);
  if (term && !maturity) {
    const months = Number(term[1]);
    terms.push({ kind: "maturity", label: `Plazo de ${plural(months, "mes", "meses")}`, days: months * 30, date: null });
  }

  const exit =
    meta.match(/(\d+(?:\.\d+)?)\s*(day|days|d)\s*(?:unstaking|unlock|withdrawal|unbonding)/i) ??
    meta.match(/(?:unstaking|unbonding)\s*cooldown:?\s*(\d+(?:\.\d+)?)\s*(days?|d)/i);
  if (exit) {
    const days = Number(exit[1]);
    terms.push({ kind: "exit", label: `Retiro en ${plural(days, "día", "días")}`, days, date: null });
  }

  const lock =
    meta.match(/(\d+(?:\.\d+)?)\s*(days?|weeks?|months?|years?)\s*lock/i) ??
    meta.match(/locked\s+[\w.]+\s*-\s*(\d+)\s*(weeks?|days?|months?)/i) ??
    meta.match(/lock\s+for\s+(\d+)\s*(years?|months?|weeks?|days?)/i);
  if (lock) {
    const days = toDays(lock[1], lock[2]);
    terms.push({ kind: "lock", label: `Bloqueo de ${plural(days, "día", "días")}`, days, date: null });
  } else if (/\block(ed|up)?\b/i.test(meta) && !exit) {
    terms.push({ kind: "lock", label: "Con bloqueo (plazo no informado)", days: null, date: null });
  }

  if (/fixed borrow/i.test(meta)) terms.push({ kind: "fixedBorrow", label: "Tasa de préstamo fija", days: null, date: null });

  const fee = meta.match(/(\d+(?:\.\d+)?)%\s*epoch fee/i);
  if (fee) terms.push({ kind: "fee", label: `Comisión de ${fee[1]}% por época`, days: null, date: null });

  return terms;
}

/* ---------- activos ---------- */

export type AssetFilter = "all" | "usd" | "eth" | "btc" | "sol";

export const ASSETS: { id: AssetFilter; label: string; hint: string }[] = [
  { id: "all", label: "Cualquier activo", hint: "Todos los pools." },
  { id: "usd", label: "Dólares", hint: "Pools de stablecoins: el precio del depósito no oscila con el mercado." },
  { id: "eth", label: "ETH", hint: "ETH y sus derivados: WETH, stETH, weETH, rETH…" },
  { id: "btc", label: "BTC", hint: "BTC envuelto o tokenizado: WBTC, cbBTC, LBTC, SolvBTC…" },
  { id: "sol", label: "SOL", hint: "SOL y sus tokens de staking: JitoSOL, mSOL, INF…" },
];

function tokensOf(symbol: string): string[] {
  return symbol
    .toUpperCase()
    .split(/[-_/\s+]+/)
    .map((t) => t.replace(/\.B$/, ""))
    .filter(Boolean);
}

/**
 * Por token y por sufijo: los derivados se nombran con la raíz al final
 * (WSTETH, JITOSOL, SOLVBTC). Así SOLVBTC es BTC y no SOL.
 */
export function assetMatches(symbol: string, stablecoin: boolean, asset: AssetFilter): boolean {
  if (asset === "all") return true;
  if (asset === "usd") return stablecoin;
  const tokens = tokensOf(symbol);
  if (asset === "eth") return tokens.some((t) => t.endsWith("ETH"));
  if (asset === "btc") return tokens.some((t) => t.endsWith("BTC") || t === "BTCB");
  return tokens.some((t) => t.endsWith("SOL") || t === "INF");
}

/* ---------- señales de riesgo ---------- */

export type RiskLevel = "low" | "medium" | "high";

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Señales bajas",
  medium: "Señales medias",
  high: "Señales altas",
};

export type RiskSignal = { id: string; label: string };

type RiskInput = {
  tvlUsd: number;
  ilRisk: boolean;
  apy: number;
  apyReward: number | null;
  outlier: boolean;
  historyDays: number | null;
  prediction: { direction: "up" | "down"; probability: number } | null;
  category: string | null;
};

const RULES: { id: string; label: string; points: number; test: (p: RiskInput) => boolean }[] = [
  { id: "tvl-tiny", label: "Poco capital depositado: menos de $1M", points: 2, test: (p) => p.tvlUsd < 1e6 },
  { id: "tvl-small", label: "Capital depositado moderado: menos de $10M", points: 1, test: (p) => p.tvlUsd >= 1e6 && p.tvlUsd < 10e6 },
  { id: "outlier", label: "Rendimiento atípico frente a su propio historial", points: 2, test: (p) => p.outlier },
  // el aviso de atípico compara al pool consigo mismo: uno que siempre pagó 200% no lo dispara
  { id: "high-apy", label: "Rendimiento superior al 50% anual: rara vez se sostiene", points: 2, test: (p) => p.apy > 50 },
  { id: "il", label: "Expuesto a pérdida impermanente", points: 1, test: (p) => p.ilRisk },
  {
    id: "rewards",
    label: "Más de la mitad del rendimiento se paga en tokens de incentivo",
    points: 1,
    test: (p) => (p.apyReward ?? 0) > 0 && p.apy > 0 && (p.apyReward ?? 0) / p.apy > 0.5,
  },
  { id: "young", label: "Menos de 30 días de historial", points: 1, test: (p) => p.historyDays !== null && p.historyDays < 30 },
  {
    id: "prediction",
    label: "El modelo de DeFiLlama anticipa una baja del rendimiento",
    points: 1,
    test: (p) => p.prediction?.direction === "down" && p.prediction.probability >= 70,
  },
  { id: "unsecured", label: "Préstamo sin colateral", points: 1, test: (p) => p.category === "Uncollateralized Lending" },
];

export function assessRisk(input: RiskInput): { level: RiskLevel; points: number; signals: RiskSignal[] } {
  const hits = RULES.filter((rule) => rule.test(input));
  const points = hits.reduce((sum, rule) => sum + rule.points, 0);
  return {
    level: points <= 1 ? "low" : points <= 3 ? "medium" : "high",
    points,
    signals: hits.map(({ id, label }) => ({ id, label })),
  };
}

export type RiskProfileId = "conservative" | "balanced" | "all";

export const RISK_PROFILES: { id: RiskProfileId; label: string; hint: string; test: (p: YieldPool) => boolean }[] = [
  {
    id: "conservative",
    label: "Conservador",
    hint: "Solo señales de riesgo bajas, sin pérdida impermanente y más de $10M depositados.",
    // la pérdida impermanente suma un solo punto, pero quien elige conservador no la acepta
    test: (p) => p.risk.level === "low" && !p.ilRisk && p.tvlUsd >= 10e6,
  },
  {
    id: "balanced",
    label: "Equilibrado",
    hint: "Sin señales altas y más de $1M depositados.",
    test: (p) => p.risk.level !== "high" && p.tvlUsd >= 1e6,
  },
  {
    id: "all",
    label: "Ver todo",
    hint: "Todos los pools con más de $100k, incluidos los de señales altas.",
    test: () => true,
  },
];

/* ---------- pool normalizado ---------- */

export type YieldPool = {
  id: string;
  project: string;
  projectName: string;
  category: string | null;
  operation: OperationId;
  chain: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  apyMean30d: number | null;
  /** cambio del APY en puntos porcentuales */
  apyChange7dPp: number | null;
  apyChange30dPp: number | null;
  stablecoin: boolean;
  ilRisk: boolean;
  exposure: "single" | "multi" | null;
  terms: Term[];
  risk: { level: RiskLevel; points: number; signals: RiskSignal[] };
  prediction: { direction: "up" | "down"; probability: number } | null;
  borrow: { apyBorrow: number | null; utilizationPct: number | null; ltvPct: number | null; borrowable: boolean } | null;
  historyDays: number | null;
  meta: string | null;
  rewardTokens: number;
};

export type RawYieldPool = {
  pool?: unknown;
  chain?: unknown;
  project?: unknown;
  symbol?: unknown;
  tvlUsd?: unknown;
  apy?: unknown;
  apyBase?: unknown;
  apyReward?: unknown;
  apyMean30d?: unknown;
  apyPct7D?: unknown;
  apyPct30D?: unknown;
  stablecoin?: unknown;
  ilRisk?: unknown;
  exposure?: unknown;
  predictions?: { predictedClass?: unknown; predictedProbability?: unknown } | null;
  poolMeta?: unknown;
  count?: unknown;
  outlier?: unknown;
  rewardTokens?: unknown;
};

export type RawLendBorrow = {
  pool?: unknown;
  apyBaseBorrow?: unknown;
  apyRewardBorrow?: unknown;
  totalSupplyUsd?: unknown;
  totalBorrowUsd?: unknown;
  ltv?: unknown;
  borrowable?: unknown;
};

export type ProtocolInfo = { name: string; category: string | null };

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/** Universo mínimo: pools que pagan algo y con al menos $100k depositados. */
export const MIN_UNIVERSE_TVL = 100_000;

export function toYieldPool(raw: RawYieldPool, directory: Map<string, ProtocolInfo>, lend: Map<string, RawLendBorrow>): YieldPool | null {
  const id = text(raw.pool);
  const project = text(raw.project);
  const chain = text(raw.chain);
  const symbol = text(raw.symbol);
  const tvlUsd = num(raw.tvlUsd);
  const apy = num(raw.apy);
  if (!id || !project || !chain || !symbol || tvlUsd === null || apy === null) return null;

  const info = directory.get(project);
  const category = info?.category ?? null;
  const meta = text(raw.poolMeta);
  const ilRisk = raw.ilRisk === "yes";
  const stablecoin = raw.stablecoin === true;
  const exposure = raw.exposure === "single" || raw.exposure === "multi" ? raw.exposure : null;
  const predictedClass = text(raw.predictions?.predictedClass);
  const probability = num(raw.predictions?.predictedProbability);
  const prediction =
    predictedClass && probability !== null
      ? { direction: /down/i.test(predictedClass) ? ("down" as const) : ("up" as const), probability }
      : null;
  const historyDays = num(raw.count);
  const apyReward = num(raw.apyReward);

  const borrowRaw = lend.get(id);
  const supplied = num(borrowRaw?.totalSupplyUsd);
  const borrowed = num(borrowRaw?.totalBorrowUsd);
  const borrowBase = num(borrowRaw?.apyBaseBorrow);
  const borrowReward = num(borrowRaw?.apyRewardBorrow);
  const ltv = num(borrowRaw?.ltv);
  const borrow = borrowRaw
    ? {
        apyBorrow: borrowBase === null && borrowReward === null ? null : (borrowBase ?? 0) - (borrowReward ?? 0),
        utilizationPct: supplied !== null && supplied > 0 && borrowed !== null ? Math.min(100, (borrowed / supplied) * 100) : null,
        ltvPct: ltv !== null ? ltv * 100 : null,
        borrowable: borrowRaw.borrowable === true,
      }
    : null;

  return {
    id,
    project,
    projectName: info?.name ?? project,
    category,
    operation: classifyOperation({ category, poolMeta: meta, exposure, ilRisk, stablecoin }),
    chain,
    symbol,
    tvlUsd,
    apy,
    apyBase: num(raw.apyBase),
    apyReward,
    apyMean30d: num(raw.apyMean30d),
    apyChange7dPp: num(raw.apyPct7D),
    apyChange30dPp: num(raw.apyPct30D),
    stablecoin,
    ilRisk,
    exposure,
    terms: parseTerms(meta),
    risk: assessRisk({ tvlUsd, ilRisk, apy, apyReward, outlier: raw.outlier === true, historyDays, prediction, category }),
    prediction,
    borrow,
    historyDays,
    meta,
    rewardTokens: Array.isArray(raw.rewardTokens) ? raw.rewardTokens.length : 0,
  };
}

/** Normaliza el universo. Los pools sin rendimiento se cuentan, no se muestran. */
export function buildUniverse(
  raws: RawYieldPool[],
  directory: Map<string, ProtocolInfo>,
  lend: Map<string, RawLendBorrow>
): { pools: YieldPool[]; withoutYield: number } {
  let withoutYield = 0;
  const pools: YieldPool[] = [];
  for (const raw of raws) {
    const pool = toYieldPool(raw, directory, lend);
    if (!pool || pool.tvlUsd < MIN_UNIVERSE_TVL) continue;
    if (pool.apy <= 0) {
      withoutYield++;
      continue;
    }
    pools.push(pool);
  }
  return { pools, withoutYield };
}

/* ---------- consulta ---------- */

export const YIELD_SORTS = ["apy", "tvl", "trend", "risk"] as const;
export type YieldSort = (typeof YIELD_SORTS)[number];

export type YieldQuery = {
  asset: AssetFilter;
  op: OperationId | "all";
  risk: RiskProfileId;
  chain: string | null;
  q: string;
  sort: YieldSort;
  dir: "asc" | "desc";
  page: number;
  size: number;
};

export function parseYieldQuery(params: URLSearchParams): YieldQuery {
  const asset = params.get("asset");
  const op = params.get("op");
  const risk = params.get("risk");
  const sort = params.get("sort");
  const page = Number(params.get("page"));
  const size = Number(params.get("size"));
  const chain = (params.get("chain") ?? "").trim().slice(0, 40);
  return {
    asset: ASSETS.some((a) => a.id === asset) ? (asset as AssetFilter) : "all",
    op: op && OPERATION_BY_ID.has(op as OperationId) ? (op as OperationId) : "all",
    risk: RISK_PROFILES.some((r) => r.id === risk) ? (risk as RiskProfileId) : "balanced",
    chain: chain === "" ? null : chain,
    q: (params.get("q") ?? "").trim().toLowerCase().slice(0, 40),
    sort: YIELD_SORTS.includes(sort as YieldSort) ? (sort as YieldSort) : "apy",
    dir: params.get("dir") === "asc" ? "asc" : "desc",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    size: [12, 25, 50].includes(size) ? size : 25,
  };
}

export function filterPools(
  pools: YieldPool[],
  query: YieldQuery,
  ignore: { op?: boolean; chain?: boolean } = {}
): YieldPool[] {
  const profile = RISK_PROFILES.find((r) => r.id === query.risk) ?? RISK_PROFILES[1];
  return pools.filter(
    (p) =>
      assetMatches(p.symbol, p.stablecoin, query.asset) &&
      profile.test(p) &&
      (ignore.op || query.op === "all" || p.operation === query.op) &&
      (ignore.chain || query.chain === null || p.chain === query.chain) &&
      (query.q === "" ||
        p.symbol.toLowerCase().includes(query.q) ||
        p.projectName.toLowerCase().includes(query.q) ||
        p.project.includes(query.q) ||
        p.chain.toLowerCase().includes(query.q))
  );
}

function sortValue(p: YieldPool, sort: YieldSort): number | null {
  if (sort === "apy") return p.apy;
  if (sort === "tvl") return p.tvlUsd;
  if (sort === "trend") return p.apyChange30dPp;
  return p.risk.points;
}

export function sortPools(pools: YieldPool[], sort: YieldSort, dir: "asc" | "desc"): YieldPool[] {
  return [...pools].sort((a, b) => {
    const va = sortValue(a, sort);
    const vb = sortValue(b, sort);
    if (va === null && vb === null) return b.tvlUsd - a.tvlUsd;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va === vb) return b.tvlUsd - a.tvlUsd;
    return dir === "asc" ? va - vb : vb - va;
  });
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  return sorted[low] + (sorted[high] - sorted[low]) * (pos - low);
}

export type OperationSummary = {
  id: OperationId;
  count: number;
  tvlUsd: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
};

/** Rango típico de rendimiento por operación: cuartiles del APY, sin ponderar. */
export function summarizeOperations(pools: YieldPool[]): OperationSummary[] {
  return OPERATIONS.map(({ id }) => {
    const group = pools.filter((p) => p.operation === id);
    const apys = group.map((p) => p.apy).sort((a, b) => a - b);
    return {
      id,
      count: group.length,
      tvlUsd: group.reduce((sum, p) => sum + p.tvlUsd, 0),
      p25: apys.length > 0 ? quantile(apys, 0.25) : null,
      median: apys.length > 0 ? quantile(apys, 0.5) : null,
      p75: apys.length > 0 ? quantile(apys, 0.75) : null,
    };
  });
}

/**
 * Destacados: el mayor APY entre pools con señales bajas, sin pérdida
 * impermanente y más de $10M, uno por protocolo para que un solo protocolo no
 * ocupe todas las tarjetas.
 */
export function pickFeatured(pools: YieldPool[], limit = 6): YieldPool[] {
  const seen = new Set<string>();
  const out: YieldPool[] = [];
  const eligible = pools.filter((p) => p.risk.level === "low" && !p.ilRisk && p.tvlUsd >= 10e6);
  for (const pool of sortPools(eligible, "apy", "desc")) {
    if (seen.has(pool.project)) continue;
    seen.add(pool.project);
    out.push(pool);
    if (out.length === limit) break;
  }
  return out;
}

/**
 * La mejor opción de cada tipo de operación, con los mismos filtros que los
 * destacados. Sin esto el ranking general lo copan las bóvedas de dólares y
 * repite la lista por activo; así se ve qué paga lo mejor de prestar, de hacer
 * staking o de fijar una tasa. "Otros" no entra: no es una operación que el
 * lector pueda elegir.
 */
export function bestByOperation(pools: YieldPool[]): YieldPool[] {
  const best = new Map<OperationId, YieldPool>();
  for (const pool of pools) {
    if (pool.operation === "other" || pool.risk.level !== "low" || pool.ilRisk || pool.tvlUsd < 10e6) continue;
    const current = best.get(pool.operation);
    if (!current || pool.apy > current.apy) best.set(pool.operation, pool);
  }
  return [...best.values()].sort((a, b) => b.apy - a.apy);
}

/* ---------- referencias y mezclas del universo ---------- */

export type YieldReference = { apy: number; name: string; poolId: string };

export type YieldPulse = {
  dollarMedianApy: number | null;
  dollarPools: number;
  ethStaking: YieldReference | null;
  solStaking: YieldReference | null;
  /** en BTC el préstamo casi no paga (se usa de colateral): la referencia es lo típico */
  btcMedianApy: number | null;
  btcPools: number;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function largest(pools: YieldPool[]): YieldReference | null {
  const top = [...pools].sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
  return top ? { apy: top.apy, name: `${top.projectName} · ${top.symbol}`, poolId: top.id } : null;
}

/**
 * Referencias del mercado, iguales para cualquier filtro: se calculan sobre
 * pools con señales bajas y más de $10M. El staking se referencia por el pool
 * más grande; dólares y BTC, por la mediana.
 */
export function buildPulse(pools: YieldPool[]): YieldPulse {
  const solid = pools.filter((p) => p.risk.level === "low" && p.tvlUsd >= 10e6);
  const dollars = solid.filter((p) => p.stablecoin);
  const bitcoin = solid.filter((p) => !p.ilRisk && assetMatches(p.symbol, p.stablecoin, "btc"));
  const staking = (asset: AssetFilter) =>
    largest(solid.filter((p) => p.operation === "stake" && assetMatches(p.symbol, p.stablecoin, asset)));
  return {
    dollarMedianApy: median(dollars.map((p) => p.apy)),
    dollarPools: dollars.length,
    ethStaking: staking("eth"),
    solStaking: staking("sol"),
    btcMedianApy: median(bitcoin.map((p) => p.apy)),
    btcPools: bitcoin.length,
  };
}

export type YieldMix = {
  risk: Record<RiskLevel, number>;
  /** pools con al menos un plazo publicado de cada tipo */
  terms: { maturity: number; exit: number; lock: number };
};

export function summarizeMix(pools: YieldPool[]): YieldMix {
  const risk: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0 };
  const terms = { maturity: 0, exit: 0, lock: 0 };
  for (const pool of pools) {
    risk[pool.risk.level]++;
    if (pool.terms.some((t) => t.kind === "maturity")) terms.maturity++;
    if (pool.terms.some((t) => t.kind === "exit")) terms.exit++;
    if (pool.terms.some((t) => t.kind === "lock")) terms.lock++;
  }
  return { risk, terms };
}

/** Los de mayor APY, uno por protocolo. */
export function topByProject(pools: YieldPool[], limit: number): YieldPool[] {
  const seen = new Set<string>();
  const out: YieldPool[] = [];
  for (const pool of sortPools(pools, "apy", "desc")) {
    if (seen.has(pool.project)) continue;
    seen.add(pool.project);
    out.push(pool);
    if (out.length === limit) break;
  }
  return out;
}

export function paginate<T>(items: T[], page: number, size: number): { rows: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  return { rows: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}
