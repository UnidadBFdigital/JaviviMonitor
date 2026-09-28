const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const load = require("./load-ts.cjs");

// La caché persiste en disco por defecto: sin una carpeta propia, una corrida
// leería las copias de la anterior y los contadores de llamadas mentirían.
const CACHE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bf-cache-tests-"));
process.env.BF_CACHE_DIR = CACHE_DIR;
test.after(() => fs.rmSync(CACHE_DIR, { recursive: true, force: true }));

const { cached } = load("lib/cache.ts");
const { parseRwaDashboardHtml } = load("lib/sources/defillamaRwa.ts");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("con memoria de fallos, una fuente caída no se reintenta en cada petición", async () => {
  let calls = 0;
  const failing = async () => {
    calls++;
    throw new Error("scrape roto");
  };
  await assert.rejects(cached("t:memo", failing, 60_000, { failureTtlMs: 60_000 }), /scrape roto/);
  await assert.rejects(cached("t:memo", failing, 60_000, { failureTtlMs: 60_000 }), /scrape roto/);
  assert.equal(calls, 1, "el segundo pedido responde con el mismo error sin volver a la red");
});

test("sin la opción, cada petición vuelve a intentar", async () => {
  let calls = 0;
  const failing = async () => {
    calls++;
    throw new Error("caída");
  };
  await assert.rejects(cached("t:nomemo", failing));
  await assert.rejects(cached("t:nomemo", failing));
  assert.equal(calls, 2);
});

test("durante la memoria de fallo se sirve el último valor válido marcado como viejo", async () => {
  let calls = 0;
  await cached("t:stale", async () => 42, 1, { failureTtlMs: 60_000 });
  await sleep(5);
  const failing = async () => {
    calls++;
    throw new Error("caída");
  };
  const first = await cached("t:stale", failing, 1, { failureTtlMs: 60_000 });
  const second = await cached("t:stale", failing, 1, { failureTtlMs: 60_000 });
  assert.deepEqual([first.data, first.stale, second.data, second.stale], [42, true, 42, true]);
  assert.equal(calls, 1);
});

test("el dashboard RWA sigue leyendo sus tres KPI cuando desaparece el conteo de emisores", () => {
  const text = [
    "## Total RWA Active Mcap", "", "$31.39b", "",
    "Total RWA Onchain Mcap$34.188b", "",
    "DeFi Active TVL$3.773b",
  ].join("\n");
  const metrics = parseRwaDashboardHtml(text, "public-reader");
  assert.equal(metrics.activeMcapUsd, 31_390_000_000);
  assert.equal(metrics.onchainMcapUsd, 34_188_000_000);
  assert.equal(metrics.defiActiveTvlUsd, 3_773_000_000);
  assert.equal(metrics.issuerCount, null, "sin rótulo no se inventa un conteo");
});

test("si el rótulo de emisores está, se lee; si falta un KPI principal, es error", () => {
  const withIssuers = "Total RWA Active Mcap $1b Total RWA Onchain Mcap $2b DeFi Active TVL $3m Total Asset Issuers <b>184</b>";
  assert.equal(parseRwaDashboardHtml(withIssuers).issuerCount, 184);
  assert.throws(() => parseRwaDashboardHtml("Total RWA Onchain Mcap $2b DeFi Active TVL $3m"), /Total RWA Active Mcap/);

  // septiembre de 2026: DeFiLlama renombró Mcap a AUM en la cabecera
  const renamed = parseRwaDashboardHtml(
    ["## Total RWA Active AUM", "", "$30.596b", "", "Total RWA Onchain AUM$33.509b", "", "DeFi Active TVL$3.771b"].join("\n"),
    "public-reader"
  );
  assert.equal(renamed.activeMcapUsd, 30_596_000_000);
  assert.equal(renamed.onchainMcapUsd, 33_509_000_000);
  assert.equal(renamed.defiActiveTvlUsd, 3_771_000_000);
});

test("el TTL puede depender del dato: un resultado parcial vence antes que uno completo", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return { partial: calls === 1 };
  };
  const ttl = (data) => (data.partial ? 1 : 60_000);
  await cached("t:ttl-fn", fetcher, ttl);
  await sleep(5);
  // el parcial venció: se sirve igual y la recarga sale por detrás
  await cached("t:ttl-fn", fetcher, ttl);
  await sleep(5);
  const third = await cached("t:ttl-fn", fetcher, ttl);
  assert.equal(third.data.partial, false, "la recarga de fondo dejó el completo");
  await cached("t:ttl-fn", fetcher, ttl);
  assert.equal(calls, 2, "el completo queda en caché");
});

test("un dato vencido se sirve al instante y la recarga va por detrás", async () => {
  let calls = 0;
  const slow = async () => {
    calls++;
    await sleep(60);
    return calls;
  };
  await cached("t:swr", slow, 1);
  await sleep(5);

  const started = Date.now();
  const served = await cached("t:swr", slow, 1);
  const waited = Date.now() - started;

  assert.equal(served.data, 1, "responde con lo que ya había");
  assert.ok(waited < 40, `no espera a la fuente lenta (esperó ${waited} ms)`);
  assert.equal(calls, 2, "pero la recarga sí salió");

  await sleep(100);
  const after = await cached("t:swr", slow, 60_000);
  assert.equal(after.data, 2, "la siguiente lectura ya trae el dato nuevo");
});

test("un dato demasiado viejo deja de servirse solo: esa petición sí espera", async () => {
  const { saveSnapshot } = load("lib/cache.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-cache-old-"));
  process.env.BF_CACHE_DIR = dir;
  try {
    await saveSnapshot("t:ancient", { data: "viejo", fetchedAt: "2020-01-01T00:00:00.000Z" });
    const served = await cached("t:ancient", async () => "nuevo", 60_000, { maxStaleMs: 60_000 });
    assert.equal(served.data, "nuevo", "pasado el límite de antigüedad se espera el dato fresco");
    assert.equal(served.stale, false);
  } finally {
    process.env.BF_CACHE_DIR = CACHE_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("una fuente frágil sobrevive a un reinicio con la copia en disco", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-cache-test-"));
  process.env.BF_CACHE_DIR = dir;
  try {
    const { saveSnapshot, readSnapshot } = load("lib/cache.ts");
    const failing = async () => {
      throw new Error("cuota agotada");
    };

    // una lectura buena queda escrita en disco
    await cached("t:persist", async () => ({ commits: 12 }), 60_000, { persist: true });
    assert.deepEqual((await readSnapshot("t:persist")).data, { commits: 12 });

    // proceso nuevo: nada en memoria, la fuente falla y se sirve la copia marcada como caché
    await saveSnapshot("t:restart", { data: { commits: 7 }, fetchedAt: "2026-09-18T10:00:00.000Z" });
    const served = await cached("t:restart", failing, 60_000, { persist: true });
    assert.deepEqual(served, { data: { commits: 7 }, fetchedAt: "2026-09-18T10:00:00.000Z", stale: true });

    // una copia todavía vigente se sirve sin consultar: un reinicio no gasta cuota
    let calls = 0;
    await saveSnapshot("t:fresh", { data: { commits: 3 }, fetchedAt: new Date().toISOString() });
    const fresh = await cached("t:fresh", async () => ++calls, 60_000, { persist: true });
    assert.equal(calls, 0);
    assert.deepEqual([fresh.data, fresh.stale], [{ commits: 3 }, false]);

    // con persist: false no se mira el disco, ni para escribir ni para leer
    await saveSnapshot("t:opt-out", { data: 1, fetchedAt: "2026-09-18T10:00:00.000Z" });
    await assert.rejects(cached("t:opt-out", failing, 60_000, { persist: false }), /cuota agotada/);
    // y sin copia previa, el error llega intacto
    await assert.rejects(cached("t:no-copy", failing, 60_000, { persist: true }), /cuota agotada/);
  } finally {
    process.env.BF_CACHE_DIR = CACHE_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("la limpieza borra las copias viejas y respeta las recientes", async () => {
  const { saveSnapshot, pruneSnapshots, readSnapshot } = load("lib/cache.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-cache-prune-"));
  process.env.BF_CACHE_DIR = dir;
  try {
    await saveSnapshot("t:vieja", { data: 1, fetchedAt: "2020-01-01T00:00:00.000Z" });
    await saveSnapshot("t:nueva", { data: 2, fetchedAt: new Date().toISOString() });
    // la antigüedad la marca el archivo, no el campo: se envejece a mano
    const archivos = fs.readdirSync(dir).map((f) => path.join(dir, f));
    const vieja = archivos.find((f) => JSON.parse(fs.readFileSync(f, "utf8")).key === "t:vieja");
    const hace30dias = Date.now() - 30 * 24 * 60 * 60 * 1000;
    fs.utimesSync(vieja, hace30dias / 1000, hace30dias / 1000);

    assert.equal(await pruneSnapshots(), 1, "solo se borra la vencida");
    assert.equal(await readSnapshot("t:vieja"), null);
    assert.equal((await readSnapshot("t:nueva")).data, 2);
  } finally {
    process.env.BF_CACHE_DIR = CACHE_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
