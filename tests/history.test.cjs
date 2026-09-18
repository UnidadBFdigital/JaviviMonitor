const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");

const { toDaily, alignSeries, unionDates, sumSeries, sliceDays, seriesStats, rebaseTogether } = load("lib/historySeries.ts");
const { classifyProtocols, buildSectors } = load("lib/rwaSectors.ts");

const day = (iso) => Date.parse(`${iso}T00:00:00Z`);

test("el último punto intradía reemplaza al del mismo día y los valores inválidos se descartan", () => {
  const points = toDaily([
    { time: day("2026-09-01"), value: 100 },
    { time: day("2026-09-02"), value: 110 },
    { time: day("2026-09-02") + 15 * 3600_000, value: 115 },
    { time: day("2026-09-03"), value: -4 },
    { time: day("2026-09-04"), value: "no numérico" },
  ]);
  assert.deepEqual(points, [
    { date: "2026-09-01", value: 100 },
    { date: "2026-09-02", value: 115 },
  ]);
});

test("un hueco dentro del rango arrastra el último valor en vez de simular una caída", () => {
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
  const series = [
    { date: "2026-09-01", value: 50 },
    { date: "2026-09-03", value: 70 },
  ];
  assert.deepEqual(alignSeries(dates, series), [50, 50, 70]);
});

test("antes de su lanzamiento un protocolo aporta cero, no un valor inventado", () => {
  const dates = ["2026-08-30", "2026-08-31", "2026-09-01"];
  assert.deepEqual(alignSeries(dates, [{ date: "2026-09-01", value: 20 }]), [0, 0, 20]);
});

test("una serie que dejó de reportar se arrastra unos días y después sale del total", () => {
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-10"];
  const series = [{ date: "2026-09-01", value: 30 }];
  assert.deepEqual(alignSeries(dates, series), [30, 30, 30, 0]);
});

test("la suma de un sector usa la unión de fechas y respeta cada rango propio", () => {
  const a = [
    { date: "2026-09-01", value: 10 },
    { date: "2026-09-02", value: 12 },
    { date: "2026-09-03", value: 14 },
  ];
  const b = [
    { date: "2026-09-02", value: 5 },
    { date: "2026-09-03", value: 6 },
  ];
  assert.deepEqual(unionDates([a, b]), ["2026-09-01", "2026-09-02", "2026-09-03"]);
  assert.deepEqual(sumSeries([a, b]), [
    { date: "2026-09-01", value: 10 },
    { date: "2026-09-02", value: 17 },
    { date: "2026-09-03", value: 20 },
  ]);
  assert.deepEqual(sumSeries([[], []]), []);
});

test("el rango se ancla en la última fecha publicada, no en hoy", () => {
  const points = Array.from({ length: 10 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    value: i,
  }));
  assert.equal(sliceDays(points, 3).length, 3);
  assert.equal(sliceDays(points, 3)[0].date, "2026-01-08");
  assert.equal(sliceDays(points, null).length, 10);
});

test("las cifras del rango salen de la serie visible", () => {
  const stats = seriesStats([
    { date: "2026-09-01", value: 100 },
    { date: "2026-09-02", value: 150 },
    { date: "2026-09-03", value: 120 },
  ]);
  assert.equal(stats.changePct, 20);
  assert.equal(stats.max.date, "2026-09-02");
  assert.equal(stats.min.value, 100);
  assert.equal(stats.fromMaxPct, -20);
  assert.equal(seriesStats([]), null);
  assert.equal(seriesStats([{ date: "2026-09-01", value: 0 }, { date: "2026-09-02", value: 5 }]).changePct, null);
});

test("la variación no se mide contra el arranque casi nulo de una serie", () => {
  const stats = seriesStats([
    { date: "2017-11-29", value: 0.001 },
    { date: "2018-01-01", value: 0.5 },
    { date: "2019-01-01", value: 100 },
    { date: "2026-09-14", value: 200 },
  ]);
  assert.equal(stats.base.date, "2019-01-01", "la base es el primer valor de al menos 1% del máximo");
  assert.equal(stats.changePct, 100);
  assert.equal(stats.first.date, "2017-11-29", "el primer punto se conserva para el gráfico");
});

test("la tarjeta de sectores y el histórico clasifican con la misma regla", () => {
  const protocols = [
    { name: "Re", slug: "re", category: "RWA", chain: "Solana", tvlUsd: 355e6, change1dPct: null, change7dPct: 2 },
    { name: "OnRe", slug: "onre", category: "RWA", chain: "Solana", tvlUsd: 300e6, change1dPct: null, change7dPct: -1 },
    { name: "Algún crédito", slug: "credito", category: "RWA Lending", chain: "Ethereum", tvlUsd: 80e6, change1dPct: null, change7dPct: 0 },
    { name: "Desconocido", slug: "x", category: "RWA", chain: "Ethereum", tvlUsd: 10e6, change1dPct: null, change7dPct: null },
  ];
  const sectorMap = { Seguros: ["Re", "OnRe"] };
  const buckets = classifyProtocols(protocols, sectorMap);
  assert.deepEqual(buckets.get("Seguros").map((p) => p.slug), ["re", "onre"]);
  assert.deepEqual(buckets.get("Crédito privado").map((p) => p.slug), ["credito"]);
  assert.deepEqual(buckets.get("Sin clasificar").map((p) => p.slug), ["x"]);

  const { sectors } = buildSectors(protocols, sectorMap);
  const seguros = sectors.find((s) => s.name === "Seguros");
  assert.equal(seguros.protocols, buckets.get("Seguros").length);
  assert.equal(seguros.tvlUsd, 655e6);
  assert.equal(sectors.at(-1).name, "Sin clasificar", "el residuo queda al final");
});

test("TVL y precio se indexan a 100 en su primer día común y solo en fechas compartidas", () => {
  const tvl = [
    { date: "2026-01-01", value: 500 },
    { date: "2026-01-02", value: 1000 },
    { date: "2026-01-03", value: 1500 },
    { date: "2026-01-04", value: 2000 },
  ];
  const price = [
    { date: "2026-01-02", value: 0 },
    { date: "2026-01-03", value: 2 },
    { date: "2026-01-04", value: 1 },
    { date: "2026-01-05", value: 4 },
  ];
  assert.deepEqual(rebaseTogether(tvl, price), [
    { date: "2026-01-03", left: 100, right: 100 },
    { date: "2026-01-04", left: (2000 / 1500) * 100, right: 50 },
  ]);
  assert.deepEqual(rebaseTogether(tvl, []), []);
});
