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
  /** Guarda en disco el último valor válido. Para fuentes frágiles (un scrape,
   *  una cuota anónima): si el proceso se reinicia justo cuando la fuente
   *  falla, se sirve la copia marcada como caché en vez de "sin respuesta". */
  persist?: boolean;
};

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
 * Devuelve el valor cacheado si sigue vigente; si no, ejecuta `fetcher`,
 * guarda el resultado y lo devuelve. Las llamadas concurrentes a la misma
 * clave comparten una sola ejecución. Si `fetcher` falla y hay un valor
 * vencido, devuelve el vencido como fallback (mejor dato viejo que nada).
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  /** fijo, o calculado sobre el dato: un resultado parcial puede vencer antes */
  ttlMs: number | ((data: T) => number) = DEFAULT_TTL_MS,
  options: CacheOptions = {}
): Promise<{ data: T; fetchedAt: string; stale: boolean }> {
  let hit = store.get(key) as Entry<T> | undefined;

  // Proceso nuevo (un reinicio, una recompilación de `next dev`): la copia en
  // disco vale con su hora original. Si sigue dentro del TTL se sirve sin
  // consultar —un reinicio no gasta cuota—; si venció, queda como respaldo.
  if (!hit && options.persist) {
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

  const failure = failures.get(key);
  if (failure && failure.until > Date.now()) {
    if (hit) return { data: hit.data, fetchedAt: hit.fetchedAt, stale: true };
    throw failure.error;
  }

  let pending = inFlight.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = (async () => {
      try {
        const data = await fetcher();
        const fetchedAt = new Date().toISOString();
        store.set(key, {
          data,
          fetchedAt,
          expiresAt: Date.now() + (typeof ttlMs === "function" ? ttlMs(data) : ttlMs),
        });
        failures.delete(key);
        if (options.persist) await saveSnapshot(key, { data, fetchedAt });
        return data;
      } catch (err) {
        if (options.failureTtlMs) failures.set(key, { error: err, until: Date.now() + options.failureTtlMs });
        throw err;
      }
    })();
    inFlight.set(key, pending);
    // se limpia siempre, resuelva o falle
    pending.catch(() => {}).finally(() => inFlight.delete(key));
  }

  try {
    const data = await pending;
    const entry = store.get(key) as Entry<T>;
    return { data, fetchedAt: entry?.fetchedAt ?? new Date().toISOString(), stale: false };
  } catch (err) {
    if (hit) return { data: hit.data, fetchedAt: hit.fetchedAt, stale: true };
    throw err;
  }
}
