const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");
const { observableNumber, metricScore, scoreActivity, ACTIVITY_METRICS, chainKey } = load("lib/bbiMethodology.ts");
const { scoreNetworks, buildBbiInsights, buildUseCaseRecommendations } = load("lib/bbi.ts");
const { parseChainActivityPage } = load("lib/sources/defillamaDashboard.ts");
const dataset = require("../data/blockchains.json");
const weights = dataset.weights;
const base = dataset.networks.find(n => n.name === "Tron");
const raw = { name: "Tron", activeUsers24h: 3393326, tvl: 5481425274, stablesMcap: 94222047027.94336, dexVolume24h: 41850851, dexVolume7d: 325459281, fees24h: 601253, fees7d: 5723545 };
const html = chains => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { chains } } })}</script>`;
const activity = parseChainActivityPage(html([raw]));

test("missing, malformed and negative inputs stay missing; real zero remains zero", () => {
  for (const value of [null, undefined, "", " ", false, [], {}, NaN, Infinity, -1, "invalid"]) assert.equal(observableNumber(value), null);
  assert.equal(observableNumber(0), 0);
  assert.equal(observableNumber("0"), 0);
  assert.equal(metricScore(null, 100, 10000), null);
  assert.equal(metricScore(0, 100, 10000), 0);
});
test("fixed logarithmic anchors are bounded, monotonic and preserve scale", () => {
  for (const metric of ACTIVITY_METRICS) {
    assert.equal(metricScore(metric.floor, metric.floor, metric.ceiling), 1);
    assert.equal(metricScore(metric.ceiling, metric.floor, metric.ceiling), 10);
    assert.equal(metricScore(metric.ceiling * 100, metric.floor, metric.ceiling), 10);
    const midpoint = Math.sqrt(metric.floor * metric.ceiling);
    assert.ok(Math.abs(metricScore(midpoint, metric.floor, metric.ceiling) - 5.5) < 1e-9);
  }
});
test("stock-only data cannot masquerade as a complete activity index", () => {
  const result = scoreActivity({ tvlUsd: 50e9, stablecoinSupplyUsd: 150e9, activeAddresses24h: null, dexVolume24hUsd: null, chainFees24hUsd: null });
  assert.equal(result.score, null);
  assert.equal(result.coverage, 45);
  assert.equal(result.complete, false);
});
test("partial coverage renormalizes present metrics and cannot enter the comparable ranking", () => {
  const partial = [{ ...activity[0], dexVolume24hUsd: null }];
  const [network] = scoreNetworks([base], [], weights, [], partial);
  assert.equal(network.activityCoverage, 85);
  assert.equal(network.bbiPartial, true);
  assert.equal(network.comparable, false);
  assert.notEqual(network.actividadEconomica, null);
  assert.ok(Math.abs(network.contributions.reduce((sum, c) => sum + c.points, 0) - network.bbi) < 1e-9);
});
test("parser retains networks without address data and doesn't invent zeros", () => {
  const rows = parseChainActivityPage(html([{ name: "Example", tvl: 10 }, { name: "Zero", activeUsers24h: 0, dexVolume24h: 0 }, { tvl: 50 }]));
  assert.equal(rows.length, 2);
  assert.equal(rows.find(n => n.name === "Example").activeAddresses24h, null);
  assert.equal(rows.find(n => n.name === "Example").chainFees24hUsd, null);
  assert.equal(rows.find(n => n.name === "Zero").dexVolume24hUsd, 0);
  assert.equal(activity[0].dexVolume7dUsd, raw.dexVolume7d);
});
test("aliases join BNB/BSC, Polygon and XRPL consistently", () => {
  assert.equal(chainKey("BNB Chain"), chainKey("BSC"));
  assert.equal(chainKey("Polygon PoS"), chainKey("Polygon"));
  assert.equal(chainKey("XRP Ledger"), chainKey("XRPL"));
  const [n] = scoreNetworks([{ ...base, name: "BNB Chain", llamaName: "BSC" }], [], weights, [], [{ ...activity[0], name: "BNB Chain" }]);
  assert.equal(n.activeAddresses24h, raw.activeUsers24h);
  assert.equal(n.comparable, true);
});
test("activity affects BBI independently of institutional opinions; no chain-specific bonus", () => {
  const [n] = scoreNetworks([base], [], weights, [], activity);
  const [renamed] = scoreNetworks([{ ...base, name: "Example", llamaName: "Example" }], [], weights, [], [{ ...activity[0], name: "Example" }]);
  assert.equal(n.bbi, renamed.bbi);
  const [stronger] = scoreNetworks([base], [], weights, [], [{ ...activity[0], activeAddresses24h: 5e6 }]);
  assert.ok(stronger.bbi > n.bbi);
  const [editorial] = scoreNetworks([{ ...base, scores: { ...base.scores, institucional: 1 } }], [], weights, [], activity);
  assert.equal(n.actividadEconomica, editorial.actividadEconomica);
  assert.ok(n.bbi > editorial.bbi);
  assert.equal(n.stablecoinSupplyUsd, raw.stablesMcap);
});
test("adding peers does not change another chain's fixed-anchor score", () => {
  const [single] = scoreNetworks([base], [], weights, [], activity);
  const batch = scoreNetworks([base, { ...base, name: "Another", llamaName: "Another" }], [], weights, [], [...activity, { ...activity[0], name: "Another", tvlUsd: 5e14 }]);
  assert.equal(batch.find(n => n.name === base.name).bbi, single.bbi);
});
test("source outages and permissioned networks are partial, with no fabricated payments leader", () => {
  const scored = scoreNetworks(dataset.networks, [], weights);
  assert.ok(scored.every(n => n.bbiPartial && !n.comparable && n.actividadEconomica === null));
  assert.ok(scored.every(n => n.stablecoinSupplyUsd === null));
  assert.ok(!buildUseCaseRecommendations(scored).some(n => n.useCase === "Pagos"));
  assert.deepEqual(buildUseCaseRecommendations([]), []);
  assert.doesNotThrow(() => buildBbiInsights(scored.slice(0, 1)));
  assert.equal(Object.values(weights).reduce((a, b) => a + b), 100);
  assert.equal(ACTIVITY_METRICS.reduce((sum, m) => sum + m.weight, 0), 100);
});
