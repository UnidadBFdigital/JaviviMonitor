const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");

const {
  classifyOperation,
  parseTerms,
  assetMatches,
  assessRisk,
  toYieldPool,
  buildUniverse,
  parseYieldQuery,
  filterPools,
  sortPools,
  summarizeOperations,
  pickFeatured,
  bestByOperation,
  paginate,
} = load("lib/yields.ts");

const base = { category: null, poolMeta: null, exposure: "single", ilRisk: false, stablecoin: false };

test("cada pool cae en la operación que un usuario reconoce", () => {
  assert.equal(classifyOperation({ ...base, category: "Lending" }), "lend");
  assert.equal(classifyOperation({ ...base, category: "Lending", poolMeta: "Fixed Borrow Rate" }), "lend", "tasa fija del que pide prestado no es tasa fija del que deposita");
  assert.equal(classifyOperation({ ...base, category: "Liquid Staking" }), "stake");
  assert.equal(classifyOperation({ ...base, category: "Liquid Restaking" }), "restake");
  assert.equal(classifyOperation({ ...base, category: "Yield", poolMeta: "For buying PT-sUSDe-22OCT2026" }), "fixed");
  assert.equal(classifyOperation({ ...base, category: "Yield", poolMeta: "For LP | Maturity 22OCT2026" }), "liquidity");
  assert.equal(classifyOperation({ ...base, category: "Dexs", exposure: "multi", ilRisk: true }), "liquidity");
  assert.equal(classifyOperation({ ...base, category: "Basis Trading", stablecoin: true, poolMeta: "7 days unstaking" }), "dollar");
  assert.equal(classifyOperation({ ...base, category: "Basis Trading", stablecoin: false }), "vault");
  assert.equal(classifyOperation({ ...base, category: "Yield", stablecoin: true }), "dollar", "tasa de ahorro en stablecoins");
  assert.equal(classifyOperation({ ...base, category: "Yield Aggregator", stablecoin: true }), "vault");
  assert.equal(classifyOperation({ ...base, category: "RWA", stablecoin: true }), "rwa");
  assert.equal(classifyOperation({ ...base, category: "Insurance" }), "other");
});

test("los plazos se leen de los metadatos en todos los formatos que publica la fuente", () => {
  const date = (meta) => parseTerms(meta).find((t) => t.kind === "maturity")?.date;
  assert.equal(date("For LP | Maturity 15OCT2026"), "2026-10-15");
  assert.equal(date("For LP | Maturity 24SEPT2026"), "2026-09-24");
  assert.equal(date("For LP on Firelight | Maturity Thu Nov 26 2026"), "2026-11-26");
  assert.equal(date("Fixed mat: 2027-06-03"), "2027-06-03");
  assert.equal(date("For buying PT-USDai-15OCT2026"), "2026-10-15");

  const days = (meta, kind) => parseTerms(meta).find((t) => t.kind === kind)?.days;
  assert.equal(days("7 days unstaking", "exit"), 7);
  assert.equal(days("30d unlock", "exit"), 30);
  assert.equal(days("Unstaking Cooldown: 15days", "exit"), 15);
  assert.equal(days("30d withdrawal cycle", "exit"), 30);
  assert.equal(days("5day lockup", "lock"), 5);
  assert.equal(days("360days lockup", "lock"), 360);
  assert.equal(days("Locked iUSD - 8 weeks", "lock"), 56);
  assert.equal(days("Lock for 4 years to earn more IQ", "lock"), 1460);
  assert.equal(parseTerms("Fixed Yield: 6 month term")[0].label, "Plazo de 6 meses");
  assert.equal(parseTerms("Lockup")[0].label, "Con bloqueo (plazo no informado)");
  assert.equal(parseTerms("5% epoch fee")[0].label, "Comisión de 5% por época");
  assert.equal(parseTerms("Fixed Borrow Rate")[0].kind, "fixedBorrow");
  assert.deepEqual(parseTerms(null), [], "sin metadatos no se inventa un plazo");
  assert.deepEqual(parseTerms("0.3%"), [], "un fee tier de DEX no es un plazo");
});

test("el filtro de activo va por token y por sufijo", () => {
  assert.equal(assetMatches("WETH-USDC", false, "eth"), true);
  assert.equal(assetMatches("WSTETH", false, "eth"), true);
  assert.equal(assetMatches("SOLVBTC", false, "btc"), true);
  assert.equal(assetMatches("SOLVBTC", false, "sol"), false, "SOLV no es SOL");
  assert.equal(assetMatches("WBTC.B-USDC", false, "btc"), true);
  assert.equal(assetMatches("JITOSOL", false, "sol"), true);
  assert.equal(assetMatches("INF", false, "sol"), true);
  assert.equal(assetMatches("ETHENAUSDC", false, "eth"), false);
  assert.equal(assetMatches("WETH-USDC", false, "usd"), false, "dólares exige que el pool sea de stablecoins");
  assert.equal(assetMatches("USDC", true, "usd"), true);
});

test("las señales de riesgo suman reglas visibles", () => {
  const safe = assessRisk({ tvlUsd: 5e9, ilRisk: false, apy: 3, apyReward: null, outlier: false, historyDays: 900, prediction: null, category: "Lending" });
  assert.equal(safe.level, "low");
  assert.deepEqual(safe.signals, []);
  const risky = assessRisk({
    tvlUsd: 500_000, ilRisk: true, apy: 120, apyReward: 100, outlier: true, historyDays: 10,
    prediction: { direction: "down", probability: 80 }, category: "Dexs",
  });
  assert.equal(risky.level, "high");
  assert.deepEqual(risky.signals.map((s) => s.id), ["tvl-tiny", "outlier", "high-apy", "il", "rewards", "young", "prediction"]);
  const steadyButHuge = assessRisk({ tvlUsd: 5e8, ilRisk: false, apy: 180, apyReward: null, outlier: false, historyDays: 900, prediction: null, category: "Dexs" });
  assert.equal(steadyButHuge.level, "medium", "un APY de tres cifras sostenido igual levanta una señal");
  const middle = assessRisk({ tvlUsd: 5e6, ilRisk: true, apy: 8, apyReward: 1, outlier: false, historyDays: 400, prediction: null, category: "Dexs" });
  assert.equal(middle.level, "medium");
});

const directory = new Map([
  ["aave-v3", { name: "Aave V3", category: "Lending" }],
  ["lido", { name: "Lido", category: "Liquid Staking" }],
  ["uniswap-v3", { name: "Uniswap V3", category: "Dexs" }],
  ["morpho-blue", { name: "Morpho Blue", category: "Lending" }],
]);

const raw = (over) => ({
  pool: "p", chain: "Ethereum", project: "aave-v3", symbol: "USDC", tvlUsd: 1e9, apy: 4, apyBase: 4, apyReward: null,
  apyMean30d: 4.1, apyPct7D: 0.1, apyPct30D: -0.2, stablecoin: true, ilRisk: "no", exposure: "single",
  predictions: { predictedClass: "Stable/Up", predictedProbability: 70 }, poolMeta: null, count: 800, outlier: false, rewardTokens: null,
  ...over,
});

test("el pool normalizado cruza categoría, préstamo y predicción sin inventar", () => {
  const lend = new Map([["a", { pool: "a", apyBaseBorrow: 5, apyRewardBorrow: 1, totalSupplyUsd: 200, totalBorrowUsd: 150, ltv: 0.75, borrowable: true }]]);
  const pool = toYieldPool(raw({ pool: "a" }), directory, lend);
  assert.equal(pool.projectName, "Aave V3");
  assert.equal(pool.operation, "lend");
  assert.deepEqual(pool.borrow, { apyBorrow: 4, utilizationPct: 75, ltvPct: 75, borrowable: true });
  assert.deepEqual(pool.prediction, { direction: "up", probability: 70 });
  assert.equal(pool.apyChange30dPp, -0.2);
  assert.equal(toYieldPool(raw({ apy: "x" }), directory, lend), null, "sin APY numérico no hay pool");
  assert.equal(toYieldPool(raw({ pool: "b", project: "desconocido" }), directory, lend).category, null);
});

test("el universo descarta pools chicos y cuenta aparte los que no rinden", () => {
  const { pools, withoutYield } = buildUniverse(
    [raw({ pool: "1" }), raw({ pool: "2", apy: 0 }), raw({ pool: "3", tvlUsd: 50_000 }), raw({ pool: "4", apy: 2 })],
    directory,
    new Map()
  );
  assert.deepEqual(pools.map((p) => p.id), ["1", "4"]);
  assert.equal(withoutYield, 1);
});

function universe() {
  return buildUniverse(
    [
      raw({ pool: "usdc", apy: 4, tvlUsd: 2e9 }),
      raw({ pool: "usdt", apy: 6, tvlUsd: 3e6 }),
      raw({ pool: "steth", project: "lido", symbol: "STETH", stablecoin: false, apy: 3, tvlUsd: 2e10 }),
      raw({ pool: "lp", project: "uniswap-v3", symbol: "WETH-USDC", stablecoin: false, ilRisk: "yes", exposure: "multi", apy: 25, tvlUsd: 4e8 }),
      raw({ pool: "degen", project: "uniswap-v3", symbol: "PEPE-WETH", stablecoin: false, ilRisk: "yes", exposure: "multi", apy: 900, apyReward: 800, outlier: true, tvlUsd: 400_000, count: 5 }),
      raw({ pool: "morpho", project: "morpho-blue", apy: 7, tvlUsd: 5e7 }),
    ],
    directory,
    new Map()
  ).pools;
}

test("el perfil de riesgo cambia qué se ve, no los datos", () => {
  const pools = universe();
  const q = (over) => ({ ...parseYieldQuery(new URLSearchParams()), ...over });
  assert.deepEqual(filterPools(pools, q({ risk: "conservative" })).map((p) => p.id).sort(), ["morpho", "steth", "usdc"]);
  assert.ok(!filterPools(pools, q({ risk: "balanced" })).some((p) => p.id === "degen"), "equilibrado oculta señales altas");
  assert.ok(filterPools(pools, q({ risk: "all" })).some((p) => p.id === "degen"));
  assert.deepEqual(filterPools(pools, q({ risk: "all", asset: "usd" })).map((p) => p.id).sort(), ["morpho", "usdc", "usdt"]);
  assert.deepEqual(filterPools(pools, q({ risk: "all", op: "liquidity" })).map((p) => p.id).sort(), ["degen", "lp"]);
  assert.deepEqual(filterPools(pools, q({ risk: "all", q: "lido" })).map((p) => p.id), ["steth"]);
});

test("orden, rangos, destacados y paginado", () => {
  const pools = universe();
  assert.deepEqual(sortPools(pools, "apy", "desc").map((p) => p.id).slice(0, 2), ["degen", "lp"]);
  assert.equal(sortPools(pools, "risk", "asc")[0].risk.points, 0);

  const summary = summarizeOperations(pools);
  const lend = summary.find((s) => s.id === "lend");
  assert.equal(lend.count, 3);
  assert.equal(lend.median, 6);
  assert.equal(summary.find((s) => s.id === "rwa").median, null, "sin pools no hay rango");

  const featured = pickFeatured(pools, 6);
  assert.deepEqual(featured.map((p) => p.id), ["morpho", "usdc", "steth"], "uno por protocolo, solo señales bajas y más de $10M");

  const best = bestByOperation(pools);
  assert.equal(new Set(best.map((p) => p.operation)).size, best.length, "una opción por tipo de operación");
  for (const pool of best) {
    assert.ok(pool.risk.level === "low" && !pool.ilRisk && pool.tvlUsd >= 10e6, `${pool.id} cumple el filtro conservador`);
    const rivals = pools.filter((p) => p.operation === pool.operation && p.risk.level === "low" && !p.ilRisk && p.tvlUsd >= 10e6);
    assert.equal(pool.apy, Math.max(...rivals.map((p) => p.apy)), `${pool.id} es la de mayor APY de su operación`);
  }
  assert.ok(best.length > 0 && best.every((p, i) => i === 0 || best[i - 1].apy >= p.apy), "ordenadas por APY");

  const page = paginate(pools, 9, 4);
  assert.deepEqual([page.page, page.pages, page.rows.length, page.total], [2, 2, 2, 6]);
});

test("los parámetros inválidos caen a valores seguros", () => {
  const q = parseYieldQuery(new URLSearchParams("asset=doge&op=casino&risk=yolo&sort=x&dir=up&page=-1&size=999&chain=%20Base%20&q=%20AAVE%20"));
  assert.deepEqual(q, { asset: "all", op: "all", risk: "balanced", chain: "Base", q: "aave", sort: "apy", dir: "desc", page: 1, size: 25 });
});
