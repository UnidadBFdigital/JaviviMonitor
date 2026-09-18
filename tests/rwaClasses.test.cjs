const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");

const { aggregateRwaAssets, extractRwaPageData, includedByDefault, SECTOR_CLASS } = load("lib/rwaClasses.ts");
const { classifyProtocols } = load("lib/rwaSectors.ts");
const tokenization = require("../data/tokenization.json");

const assets = [
  { type: "Asset", category: ["Stocks & Equities"], parentPlatform: "Ondo", activeMcap: { total: 100 }, onChainMcap: { total: 120 }, defiActiveTvl: { total: 5 } },
  { type: "Asset", category: ["Stocks & Equities", "Bond & MMF Funds"], parentPlatform: "Ondo", activeMcap: { total: 10 }, onChainMcap: { total: 10 }, defiActiveTvl: null },
  { type: "Perp", category: ["Stocks & Equities"], activeMcap: { total: 999 } },
  { type: "Wrapper", category: ["RWA Wrappers"], activeMcap: { total: 50 } },
  { type: "Asset", stablecoin: true, category: ["Fiat Stablecoins"], activeMcap: { total: 1000 } },
  { type: "Asset", governance: true, category: ["Governance Tokens"], activeMcap: { total: 70 } },
  { type: "Asset", category: ["Bond & MMF Funds"], parentPlatform: "Franklin Templeton", activeMcap: { total: 200 }, onChainMcap: { total: "x" } },
];

test("el perímetro por defecto deja fuera perps, wrappers, stablecoins y gobernanza", () => {
  assert.deepEqual(assets.map((a) => includedByDefault(a)), [true, true, false, false, false, false, true]);
  const { totals, assets: count } = aggregateRwaAssets(assets);
  assert.deepEqual(totals, { activeMcapUsd: 310, onchainMcapUsd: 130, defiActiveTvlUsd: 5 });
  assert.equal(count, 3);
});

test("un activo con dos categorías suma en ambas, así que las clases no suman el total", () => {
  const { classes } = aggregateRwaAssets(assets);
  const byName = Object.fromEntries(classes.map((c) => [c.name, c]));
  assert.equal(byName["Bond & MMF Funds"].activeMcapUsd, 210);
  assert.equal(byName["Bond & MMF Funds"].assets, 2);
  assert.equal(byName["Stocks & Equities"].activeMcapUsd, 110);
  assert.equal(byName["Stocks & Equities"].label, "Acciones y participaciones");
  assert.equal(classes[0].name, "Bond & MMF Funds", "ordenadas por market cap activo");
  assert.equal(byName["RWA Wrappers"], undefined, "lo excluido no aparece como clase");
});

test("las plataformas agregan su market cap activo, también las que no tienen TVL en /protocols", () => {
  const { platforms } = aggregateRwaAssets(assets);
  assert.deepEqual(platforms.map((p) => [p.name, p.activeMcapUsd, p.assets]), [["Franklin Templeton", 200, 1], ["Ondo", 110, 2]]);
});

test("se lee el perímetro que publica la página y un HTML sin datos devuelve null", () => {
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { assets: assets.slice(0, 4), defaultInclusion: { includeWrappers: true, includeBridgeTvl: true } } },
  })}</script></html>`;
  const page = extractRwaPageData(html);
  assert.equal(page.assets.length, 4);
  assert.equal(page.inclusion.includeWrappers, true);
  assert.equal(page.inclusion.includeRwaPerps, false);
  assert.equal(aggregateRwaAssets(page.assets, page.inclusion).totals.activeMcapUsd, 160, "con wrappers incluidos suma los 50 del wrapper");
  assert.equal(extractRwaPageData("<html>sin datos</html>"), null);
  assert.equal(extractRwaPageData('<script id="__NEXT_DATA__">{roto</script>'), null);
});

test("cada sector con clase equivalente existe en el mapa: un renombre no puede romper el cruce en silencio", () => {
  for (const sector of Object.keys(SECTOR_CLASS)) {
    assert.ok(Object.hasOwn(tokenization.sectorMap, sector), `el sector «${sector}» no está en data/tokenization.json`);
  }
});

test("los protocolos de acciones tokenizadas fuera de Ondo también entran al sector", () => {
  const protocols = ["Ondo Global Markets", "xStocks", "Dinari", "Huma Finance V2", "Meld Gold"].map((name) => ({
    name, slug: name.toLowerCase(), category: "RWA", chain: "Ethereum", tvlUsd: 1, change1dPct: null, change7dPct: null,
  }));
  const buckets = classifyProtocols(protocols, tokenization.sectorMap);
  assert.deepEqual(buckets.get("Acciones tokenizadas").map((p) => p.name), ["Ondo Global Markets", "xStocks", "Dinari"]);
  assert.deepEqual(buckets.get("Crédito privado").map((p) => p.name), ["Huma Finance V2"]);
  assert.deepEqual(buckets.get("Commodities (metales)").map((p) => p.name), ["Meld Gold"]);
});
