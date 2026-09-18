const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");

const { normalizeComponent, scoreUniverse, computeMomentum, buildResearchSignals, toolingScore, PILLARS, PROFILES, COMPONENTS } =
  load("lib/networks/score.ts");
const { windowChangePct, calendarValues, feesPerActiveUser, defaultBranchStalled } = load("lib/networks/series.ts");

// Red mínima con la forma del esquema interno. Cada prueba altera solo lo que
// mide, para que un fallo señale la regla rota y no el andamiaje.
function network(id, overrides = {}) {
  const base = {
    id,
    name: id,
    layer: "L1",
    kind: "L1",
    vm: "EVM",
    language: "Solidity",
    settlesOn: null,
    gasToken: "TKN",
    launched: 2020,
    blockTimeSec: 2,
    finalitySec: 10,
    finalityNote: "",
    feeModel: "",
    docs: "",
    faucet: null,
    grants: null,
    repo: "org/repo",
    keys: { llama: id, growthepie: id, l2beat: null, bbi: null },
    tooling: {
      evm: true,
      foundry: true,
      hardhat: true,
      remix: true,
      accountAbstraction: "ERC-4337",
      oracles: ["Chainlink"],
      indexers: ["The Graph"],
      wallets: ["MetaMask"],
      sdks: ["viem"],
    },
    cost: { medianUsd: 0.01, avg7dUsd: 0.01, avg30dUsd: 0.01, min30dUsd: 0.005, max30dUsd: 0.02, volatility30d: 0.2, change7dPct: 0, change30dPct: 0, change90dPct: null, unavailable: null },
    activity: { activeAddresses24h: 1000, dailyActiveAddresses: 1000, txCount24h: 100000, observedTps: 1.2, throughputGasPerSec: 5, daaChange7dPct: 0, daaChange30dPct: 0, daaChange90dPct: null, txChange7dPct: 0, txChange30dPct: 0, txChange90dPct: null, unavailable: null },
    liquidity: { tvlUsd: 1e9, tvlChange7dPct: 0, tvlChange30dPct: 0, tvlChange90dPct: null, stablecoinUsd: 1e9, dexVolume24hUsd: 1e7, dexVolume7dUsd: 1e8, chainFees24hUsd: 1e5, protocols: 100 },
    rwa: { protocolCount: 1, tvlUsd: 1e6, note: "" },
    dev: { repo: "org/repo", repoNote: null, commits4w: 40, commits12w: 120, commits52w: 500, commitsPrev12w: 100, commitsChangePct: 20, stars: 100, contributors: null, pushedAt: null, ecosystemDevelopers: null, ecosystemDevelopersSource: "", unavailable: null },
    arch: { stage: null, category: "L1", dataAvailability: null, providers: [], risks: [], blockTimeSec: 2, finalitySec: 10, securityScore: 8, securityBasis: "test", institutionalScore: 7 },
    history: { cost: [], daa: [], tvl: [], commits: [] },
    explorers: [],
    rpcs: [],
    sources: [],
  };
  return {
    ...base,
    ...overrides,
    cost: { ...base.cost, ...(overrides.cost ?? {}) },
    activity: { ...base.activity, ...(overrides.activity ?? {}) },
    liquidity: { ...base.liquidity, ...(overrides.liquidity ?? {}) },
    dev: { ...base.dev, ...(overrides.dev ?? {}) },
    arch: { ...base.arch, ...(overrides.arch ?? {}) },
    tooling: { ...base.tooling, ...(overrides.tooling ?? {}) },
  };
}

/** Una L1 no-EVM tal como llega hoy: sin ninguna serie de growthepie. */
function sinGrowthepie(id) {
  return network(id, {
    vm: "SVM",
    keys: { llama: id, growthepie: null, l2beat: null, bbi: id },
    cost: { medianUsd: null, avg7dUsd: null, avg30dUsd: null, min30dUsd: null, max30dUsd: null, volatility30d: null, change7dPct: null, change30dPct: null },
    activity: { activeAddresses24h: 2_000_000, dailyActiveAddresses: null, txCount24h: null, observedTps: null, throughputGasPerSec: null, daaChange7dPct: null, daaChange30dPct: null, txChange7dPct: null, txChange30dPct: null },
    tooling: { evm: false, foundry: false, hardhat: false, remix: false },
  });
}

const feesSpec = COMPONENTS.find((c) => c.id === "feesPerUser");
const tvlSpec = COMPONENTS.find((c) => c.id === "tvl");

test("un dato ausente no se convierte en cero al normalizar", () => {
  const scores = normalizeComponent([1, 10, null, 1000], tvlSpec);
  assert.equal(scores[2], null);
  assert.ok(scores[0] < scores[3]);
});

test("la dirección se invierte donde el valor bajo es mejor", () => {
  const cheap = normalizeComponent([0.001, 1], feesSpec);
  assert.ok(cheap[0] > cheap[1], "lo barato debe puntuar más alto que lo caro");
});

test("un outlier extremo no aplasta al resto: winsorización al 5/95", () => {
  const sinOutlier = normalizeComponent([10, 100, 1000], tvlSpec);
  const conOutlier = normalizeComponent([10, 100, 1000, 1e15], tvlSpec);
  assert.ok(conOutlier[1] > 5, "la mediana no puede colapsar contra cero por un outlier");
  assert.equal(sinOutlier[2], 100);
});

test("los pilares solo usan datos que existen para todas las redes", () => {
  for (const pillar of PILLARS) {
    for (const id of Object.keys(pillar.components)) {
      const spec = COMPONENTS.find((c) => c.id === id);
      assert.equal(spec.coverage, "universal", `${pillar.id} usa ${id}, que no cubre a todo el universo`);
    }
  }
});

test("una L1 sin series de growthepie puntúa con los cinco pilares y cobertura completa", () => {
  const scored = scoreUniverse([sinGrowthepie("solana"), network("ethereum"), network("base")], "general");
  const solana = scored.get("solana");
  assert.ok(solana.score !== null);
  assert.equal(solana.coverage, 100);
  for (const pillar of solana.pillars) assert.ok(pillar.score !== null, `el pilar ${pillar.id} quedó vacío`);
});

test("un pilar sin cobertura suficiente queda en null, no en cero", () => {
  const sinComisiones = network("a", { liquidity: { chainFees24hUsd: null } });
  const scored = scoreUniverse([sinComisiones, network("b"), network("c")], "general");
  const economic = scored.get("a").pillars.find((p) => p.id === "economic");
  assert.equal(economic.score, null);
  assert.ok(economic.coverage < 50);
  assert.ok(scored.get("a").coverage < 100, "la cobertura total debe reflejar el pilar ausente");
  assert.ok(scored.get("a").score !== null, "el resto de los pilares sigue puntuando");
});

test("comisiones por usuario: usa growthepie cuando DeFiLlama publica cero direcciones", () => {
  const op = network("op", { activity: { activeAddresses24h: 0, dailyActiveAddresses: 2000 }, liquidity: { chainFees24hUsd: 400 } });
  const result = feesPerActiveUser(op);
  assert.equal(result.value, 0.2);
  assert.match(result.source, /growthepie/);
  assert.equal(feesPerActiveUser(network("x", { liquidity: { chainFees24hUsd: null } })).value, null);
  assert.equal(
    feesPerActiveUser(network("y", { activity: { activeAddresses24h: 0, dailyActiveAddresses: null } })).value,
    null,
    "sin direcciones no hay divisor: no se inventa"
  );
});

test("cambiar de perfil cambia el orden, no los datos", () => {
  const barata = network("barata", { liquidity: { chainFees24hUsd: 10, tvlUsd: 1e6, stablecoinUsd: 1e6 } });
  const liquida = network("liquida", { liquidity: { chainFees24hUsd: 5e6, tvlUsd: 5e10, stablecoinUsd: 5e10 } });
  const universe = [barata, liquida, network("media")];
  const pagos = scoreUniverse(universe, "payments");
  const defi = scoreUniverse(universe, "defi");
  assert.ok(pagos.get("barata").score > pagos.get("liquida").score, "pagos premia el costo bajo");
  assert.ok(defi.get("liquida").score > defi.get("barata").score, "DeFi premia la liquidez");
});

test("todos los perfiles reparten exactamente cien puntos entre los pilares", () => {
  for (const profile of PROFILES) {
    const total = PILLARS.reduce((sum, pillar) => sum + profile.pillars[pillar.id], 0);
    assert.equal(total, 100, `el perfil ${profile.id} no suma 100`);
  }
});

test("cada refuerzo de un perfil apunta a un componente que está en algún pilar", () => {
  const inPillars = new Set(PILLARS.flatMap((p) => Object.keys(p.components)));
  for (const profile of PROFILES) {
    for (const id of Object.keys(profile.emphasis)) {
      assert.ok(inPillars.has(id), `${profile.id} refuerza ${id}, que no pesa en ningún pilar: el refuerzo no tendría efecto`);
    }
  }
});

test("el momentum ajusta por tamaño: una base chica no encabeza sola", () => {
  const chica = network("chica", { liquidity: { tvlUsd: 1e6, tvlChange30dPct: 200 } });
  const grande = network("grande", { liquidity: { tvlUsd: 1e10, tvlChange30dPct: 20 } });
  const momentum = computeMomentum([chica, grande, network("media")], 30);
  assert.ok(momentum.get("chica").rawGrowthPct > momentum.get("grande").rawGrowthPct, "el crecimiento crudo es mayor");
  assert.ok(momentum.get("chica").sizeFactor < momentum.get("grande").sizeFactor, "el factor de tamaño la corrige");
  assert.equal(momentum.get("chica").emerging, true, "se publica como emergente, no como líder");
});

test("una red sin series diarias tiene momentum igual que una EVM", () => {
  const momentum = computeMomentum([sinGrowthepie("sol"), network("eth")], 30);
  assert.ok(momentum.get("sol").rawGrowthPct !== null);
  assert.ok(momentum.get("sol").parts.every((p) => p.inComposite), "sin direcciones diarias no aparece esa parte");
  assert.ok(momentum.get("eth").parts.some((p) => !p.inComposite), "en EVM las direcciones van como detalle");
});

test("sin tendencia de TVL no hay momentum, aunque el repositorio se mueva", () => {
  const soloRepo = network("solo-repo", { liquidity: { tvlChange7dPct: null, tvlChange30dPct: null }, dev: { commitsChangePct: -80 } });
  const momentum = computeMomentum([soloRepo, network("otra")], 30);
  assert.equal(momentum.get("solo-repo").rawGrowthPct, null);
  assert.equal(momentum.get("solo-repo").signal, null);
});

test("la señal de tendencia no contradice a la cifra que se publica", () => {
  const universe = [
    network("sube", { liquidity: { tvlChange30dPct: 30, tvlChange7dPct: 40 } }),
    network("baja", { liquidity: { tvlChange30dPct: -30, tvlChange7dPct: -40 } }),
  ];
  const momentum = computeMomentum(universe, 30);
  for (const [id, m] of momentum) {
    if (m.rawGrowthPct === null) continue;
    const positiva = ["Acelerando", "Creciendo"].includes(m.signal);
    assert.equal(positiva, m.rawGrowthPct > 2, `${id}: la señal y el crecimiento apuntan a lados distintos`);
  }
});

test("las señales de research salen de los datos y nunca muestran huecos", () => {
  const universe = [network("x", { liquidity: { tvlChange30dPct: 25 } }), sinGrowthepie("y")];
  const signals = buildResearchSignals(universe, computeMomentum(universe, 30), 30, 2);
  assert.equal(signals.length, 2);
  for (const signal of signals) {
    for (const row of signal.data) {
      assert.match(row.value, /^[+−]\d+(\.\d+)?%$/, "toda cifra lleva signo y unidad");
    }
    assert.ok(signal.interpretation.length > 0);
  }
});

test("una rama principal quieta con pushes recientes no se publica como cero commits", () => {
  const now = Date.parse("2026-09-14T00:00:00Z");
  const base = { repo: "OffchainLabs/nitro", commits12w: 0, commitsPrev12w: 1332, pushedAt: "2026-08-31T15:02:27Z" };
  assert.match(defaultBranchStalled(base, now), /rama principal/);
  assert.equal(defaultBranchStalled({ ...base, commits12w: 40 }, now), null, "con commits el conteo sirve");
  assert.equal(defaultBranchStalled({ ...base, pushedAt: "2026-05-01T00:00:00Z" }, now), null, "sin pushes recientes el repo de verdad está quieto");
  assert.equal(defaultBranchStalled({ ...base, commitsPrev12w: 3 }, now), null, "un repo casi inactivo no dispara la regla");
});

test("una ventana incompleta no produce una variación comparable", () => {
  const corta = Array.from({ length: 5 }, (_, i) => ({ date: `2026-09-0${i + 1}`, value: 10 }));
  assert.equal(windowChangePct(corta, 7), null);
  assert.equal(windowChangePct(undefined, 30), null);
});

test("las ventanas se anclan en la última fecha publicada", () => {
  const series = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, i + 1)).toISOString().slice(0, 10),
    value: i < 7 ? 100 : 200,
  }));
  assert.equal(calendarValues(series, 7).length, 7);
  assert.equal(windowChangePct(series, 7), 100, "de 100 a 200 es +100%");
});

test("el stack no-EVM no queda en cero por no tener Foundry", () => {
  const solana = network("solana", {
    faucet: "https://faucet",
    tooling: {
      evm: false,
      foundry: false,
      hardhat: false,
      remix: false,
      accountAbstraction: "Nativa",
      oracles: ["Pyth", "Switchboard"],
      indexers: ["Helius", "Subsquid"],
      wallets: ["Phantom", "Solflare", "Backpack"],
      sdks: ["Anchor", "web3.js"],
    },
  });
  assert.ok(toolingScore(solana) >= 5, "un stack propio completo debe puntuar, no castigarse por la VM");
  assert.ok(toolingScore(solana) <= 10);
});
