// Cache en memoria con TTL, compartido por todos los módulos de datos.
// Evita repetir llamadas a las APIs externas (y gastar cuota) dentro del TTL.
//
// Sin imports de `node:*`: componentes de cliente importan constantes de
// lib/sources/* y, con ellas, este archivo. Un import estático de `node:fs`
// rompe el bundle del navegador; los módulos de Node se piden en tiempo de
// ejecución y solo existen en el servidor.
type Entry<T> = {
  data: T;
  fetchedAt: string; // ISO — se muestra en la UI como "última consulta"
  expiresAt: number;
};

const store = new Map<string, Entry<unknown>>();

// Peticiones en vuelo: varias vistas piden la misma fuente a la vez (por
// ejemplo la home llama a CoinGecko desde dos endpoints). Sin esto, con el
// cache frío se dispararían llamadas duplicadas contra APIs con rate limit.
const inFlight = new Map<string, Promise<unknown>>();

export const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hora

// Fallos recientes por clave, solo para las fuentes que lo piden. Una fuente
// que cae (un scrape roto, un 403 de Cloudflare) no debe cobrarle a cada
// petición el tiempo de volver a fallar.
const failures = new Map<string, { error: unknown; until: number }>();

export type CacheOptions = {
  /** Durante este lapso tras un fallo no se reintenta: se sirve el valor
   *  vencido si lo hay, o se relanza el mismo error al instante. */
  failureTtlMs?: number;
  /** Copia en disco del último valor válido, activa por defecto: un reinicio
   *  no vuelve a descargar nada ni deja una vista en "sin respuesta".
   *  `false` para datos que no valga la pena escribir. */
  persist?: boolean;
  /** Cuánto se acepta seguir sirviendo un dato vencido mientras se refresca
   *  por detrás. Pasado ese punto, la petición espera el dato nuevo. */
  maxStaleMs?: number;
};

/** Tras 24 h sin poder refrescar, el dato deja de servirse sin avisar. */
const DEFAULT_MAX_STALE_MS = 24 * 60 * 60 * 1000;

/* ---------- copia en disco ---------- */

/** fs, os, path y crypto de Node, o null fuera del servidor */
function nodeModules() {
  const get = typeof process !== "undefined" ? process.getBuiltinModule : undefined;
  if (typeof get !== "function") return null;
  return {
    fs: get("node:fs/promises"),
    os: get("node:os"),
    path: get("node:path"),
    crypto: get("node:crypto"),
  };
}

// En el directorio temporal del sistema: escribible también donde la carpeta
// del proyecto es de solo lectura, y fuera del alcance del observador de
// archivos de `next dev`. BF_CACHE_DIR lo cambia (lo usan las pruebas).
function snapshotPath(node: NonNullable<ReturnType<typeof nodeModules>>, key: string): string {
  const dir = process.env.BF_CACHE_DIR || node.path.join(node.os.tmpdir(), "blockfinity-research-cache");
  return node.path.join(dir, `${node.crypto.createHash("sha1").update(key).digest("hex")}.json`);
}

type Snapshot<T> = { data: T; fetchedAt: string };

export async function saveSnapshot<T>(key: string, snapshot: Snapshot<T>): Promise<void> {
  const node = nodeModules();
  if (!node) return;
  try {
    const file = snapshotPath(node, key);
    await node.fs.mkdir(node.path.dirname(file), { recursive: true });
    await node.fs.writeFile(file, JSON.stringify({ key, ...snapshot }));
  } catch {
    // la copia es un respaldo: si el disco no deja escribir, se sigue sin ella
  }
}

export async function readSnapshot<T>(key: string): Promise<Snapshot<T> | null> {
  const node = nodeModules();
  if (!node) return null;
  try {
    const raw = JSON.parse(await node.fs.readFile(snapshotPath(node, key), "utf8")) as Snapshot<T> & { key?: string };
    return raw.key === key && typeof raw.fetchedAt === "string" ? { data: raw.data, fetchedAt: raw.fetchedAt } : null;
  } catch {
    return null;
  }
}

/**
 * Devuelve el valor cacheado si sigue vigente. Si venció, devuelve el que hay
 * —al instante— y manda la recarga por detrás: quien llega justo después del
 * vencimiento ya no paga la descarga completa. Solo espera quien no tiene nada
 * que leer: la primera carga de la clave, o un dato tan viejo que ya no sirve.
 *
 * Las llamadas concurrentes a la misma clave comparten una sola ejecución, y
 * un fallo del `fetcher` nunca tumba al que pidió: se sirve lo anterior marcado
 * como caché.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  /** fijo, o calculado sobre el dato: un resultado parcial puede vencer antes */
  ttlMs: number | ((data: T) => number) = DEFAULT_TTL_MS,
  options: CacheOptions = {}
): Promise<{ data: T; fetchedAt: string; stale: boolean }> {
  const persist = options.persist !== false;
  let hit = store.get(key) as Entry<T> | undefined;

  // Proceso nuevo (un reinicio, una recompilación de `next dev`): la copia en
  // disco vale con su hora original. Si sigue dentro del TTL se sirve sin
  // consultar —un reinicio no gasta cuota—; si venció, queda como respaldo.
  if (!hit && persist) {
    const snapshot = await readSnapshot<T>(key);
    if (snapshot) {
      const ttl = typeof ttlMs === "function" ? ttlMs(snapshot.data) : ttlMs;
      hit = { ...snapshot, expiresAt: Date.parse(snapshot.fetchedAt) + ttl };
      if (!store.has(key)) store.set(key, hit);
    }
  }

  if (hit && hit.expiresAt > Date.now()) {
    return { data: hit.data, fetchedAt: hit.fetchedAt, stale: false };
  }

  /** Una sola recarga por clave, la compartan quienes la compartan. */
  const refresh = (): Promise<T> => {
    const running = inFlight.get(key) as Promise<T> | undefined;
    if (running) return running;
    const started = (async () => {
      try {
        const data = await fetcher();
        const fetchedAt = new Date().toISOString();
        store.set(key, {
          data,
          fetchedAt,
          expiresAt: Date.now() + (typeof ttlMs === "function" ? ttlMs(data) : ttlMs),
        });
        failures.delete(key);
        if (persist) await saveSnapshot(key, { data, fetchedAt });
        return data;
      } catch (err) {
        if (options.failureTtlMs) failures.set(key, { error: err, until: Date.now() + options.failureTtlMs });
        throw err;
      }
    })();
    inFlight.set(key, started);
    // se limpia siempre, resuelva o falle
    started.catch(() => {}).finally(() => inFlight.delete(key));
    return started;
  };

  const failure = failures.get(key);
  const failing = failure !== undefined && failure.until > Date.now();

  if (hit) {
    const age = Date.now() - Date.parse(hit.fetchedAt);
    if (age < (options.maxStaleMs ?? DEFAULT_MAX_STALE_MS)) {
      // se refresca por detrás, salvo que la fuente esté en su ventana de fallo
      if (!failing) void refresh().catch(() => {});
      // dentro de un TTL de gracia el dato es tan bueno como antes de vencer;
      // más viejo que eso, viaja marcado como caché. La hora real siempre va
      // en fetchedAt, así que la interfaz nunca miente sobre la edad.
      const grace = typeof ttlMs === "function" ? ttlMs(hit.data) : ttlMs;
      return { data: hit.data, fetchedAt: hit.fetchedAt, stale: age > grace * 2 };
    }
  }

  if (failing) {
    if (hit) return { data: hit.data, fetchedAt: hit.fetchedAt, stale: true };
    throw failure!.error;
  }

  // Sin nada que servir: toca esperar.
  try {
    const data = await refresh();
    const entry = store.get(key) as Entry<T>;
    return { data, fetchedAt: entry?.fetchedAt ?? new Date().toISOString(), stale: false };
  } catch (err) {
    if (hit) return { data: hit.data, fetchedAt: hit.fetchedAt, stale: true };
    throw err;
  }
}

/**
 * Limpia las copias en disco que hayan superado la antigüedad máxima permitida.
 */
export async function pruneSnapshots(maxAgeMs = DEFAULT_MAX_STALE_MS): Promise<number> {
  const node = nodeModules();
  if (!node) return 0;

  try {
    const dir = process.env.BF_CACHE_DIR || node.path.join(node.os.tmpdir(), "blockfinity-research-cache");
    const files = await node.fs.readdir(dir);
    const now = Date.now();
    let removed = 0;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = node.path.join(dir, file);
      try {
        const stat = await node.fs.stat(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          await node.fs.unlink(filePath);
          removed++;
        }
      } catch {
        // Ignorar errores al leer/eliminar un archivo individual
      }
    }
    return removed;
  } catch {
    return 0;
  }
}