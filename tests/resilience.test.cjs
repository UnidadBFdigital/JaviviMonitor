const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");

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
  const second = await cached("t:ttl-fn", fetcher, ttl);
  assert.equal(second.data.partial, false, "el parcial venció y se volvió a pedir");
  await cached("t:ttl-fn", fetcher, ttl);
  assert.equal(calls, 2, "el completo queda en caché");
});

test("una fuente frágil sobrevive a un reinicio con la copia en disco", async () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
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

    // sin persist, el mismo caso sigue fallando: la copia es opt-in
    await saveSnapshot("t:opt-in", { data: 1, fetchedAt: "2026-09-18T10:00:00.000Z" });
    await assert.rejects(cached("t:opt-in", failing), /cuota agotada/);
    // y sin copia previa, el error llega intacto
    await assert.rejects(cached("t:no-copy", failing, 60_000, { persist: true }), /cuota agotada/);
  } finally {
    delete process.env.BF_CACHE_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
