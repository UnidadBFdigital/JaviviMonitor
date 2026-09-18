const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");

const { parseScreenerQuery, queryScreener, matchScore, thumbUrl } = load("lib/marketScreener.ts");

const coin = (over) => ({
  id: "x", symbol: "X", name: "X", image: null, rank: null, priceUsd: null,
  change1hPct: null, change24hPct: null, change7dPct: null, change30dPct: null,
  marketCapUsd: null, volume24hUsd: null, high24hUsd: null, low24hUsd: null, athDrawdownPct: null,
  ...over,
});

const universe = [
  coin({ id: "bitcoin", symbol: "BTC", name: "Bitcoin", rank: 1, marketCapUsd: 2e12, change24hPct: 1 }),
  coin({ id: "ethereum", symbol: "ETH", name: "Ethereum", rank: 2, marketCapUsd: 5e11, change24hPct: -2 }),
  coin({ id: "wrapped-bitcoin", symbol: "WBTC", name: "Wrapped Bitcoin", rank: 20, marketCapUsd: 1e10, change24hPct: null }),
  coin({ id: "bitcoin-cash", symbol: "BCH", name: "Bitcoin Cash", rank: 15, marketCapUsd: 8e9, change24hPct: 5 }),
];

const query = (over) => ({ q: "", sort: "rank", dir: "asc", page: 1, size: 25, ...over });

test("los parámetros inválidos caen al valor por defecto", () => {
  const q = parseScreenerQuery(new URLSearchParams("q=%20BTC%20&sort=drop&dir=x&page=-3&size=7"));
  assert.deepEqual(q, { q: "btc", sort: "rank", dir: "asc", page: 1, size: 50 });
  assert.equal(parseScreenerQuery(new URLSearchParams("sort=d24h&dir=desc&size=100&page=3")).size, 100);
});

test("buscando, el símbolo exacto va primero y después el nombre", () => {
  const { rows, total } = queryScreener(universe, query({ q: "bitcoin" }));
  assert.equal(total, 3);
  assert.deepEqual(rows.map((r) => r.id), ["bitcoin", "bitcoin-cash", "wrapped-bitcoin"]);
  assert.equal(matchScore(universe[0], "btc"), 0);
  assert.equal(matchScore(universe[2], "btc"), 3);
  assert.equal(matchScore(universe[1], "sol"), null);
});

test("el orden por columna deja los faltantes al final en ambas direcciones", () => {
  const desc = queryScreener(universe, query({ sort: "d24h", dir: "desc" })).rows.map((r) => r.symbol);
  const asc = queryScreener(universe, query({ sort: "d24h", dir: "asc" })).rows.map((r) => r.symbol);
  assert.deepEqual(desc, ["BCH", "BTC", "ETH", "WBTC"]);
  assert.deepEqual(asc, ["ETH", "BTC", "BCH", "WBTC"]);
});

test("una página fuera de rango se recorta a la última", () => {
  const result = queryScreener(universe, query({ size: 25, page: 9 }));
  assert.deepEqual([result.page, result.pages, result.rows.length], [1, 1, 4]);
  const empty = queryScreener(universe, query({ q: "zzz" }));
  assert.deepEqual([empty.total, empty.pages, empty.rows.length], [0, 1, 0]);
});

test("los logos usan la miniatura y solo del CDN de CoinGecko", () => {
  assert.equal(
    thumbUrl("https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400"),
    "https://coin-images.coingecko.com/coins/images/1/thumb/bitcoin.png?1696501400"
  );
  assert.equal(thumbUrl("https://evil.example/large/x.png"), null);
  assert.equal(thumbUrl("http://coin-images.coingecko.com/coins/images/1/large/b.png"), null);
  assert.equal(thumbUrl(null), null);
});
