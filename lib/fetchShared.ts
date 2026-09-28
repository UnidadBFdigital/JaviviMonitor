"use client";

// Varias cards de una misma vista consumen el mismo endpoint (por ejemplo
// la portada y el hub leen ambos /api/tokenization/rwa). Sin esto, cada uno
// dispara su propia petición idéntica en cada carga.
//
// Deduplica por URL y reutiliza la respuesta durante la frescura que declara
// la propia ruta en su cabecera Cache-Control. Así volver a un módulo ya
// visitado no dispara ninguna petición: ni a la red ni al servidor. El TTL real
// de los datos sigue viviendo en el servidor (lib/cache.ts); acá solo se evita
// repetir lo que ya se tiene.

const FALLBACK_TTL_MS = 60 * 1000;

type Cached = { at: number; ttlMs: number; promise: Promise<unknown> };

const cache = new Map<string, Cached>();

/** Lee max-age de la cabecera; sin cabecera, la ventana corta de siempre. */
function freshnessOf(header: string | null): number {
  const match = header?.match(/max-age=(\d+)/);
  if (!match || /no-store/.test(header ?? "")) return FALLBACK_TTL_MS;
  return Number(match[1]) * 1000;
}

export function fetchShared<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < hit.ttlMs) {
    return hit.promise as Promise<T>;
  }

  const entry: Cached = { at: Date.now(), ttlMs: FALLBACK_TTL_MS, promise: Promise.resolve(null) };
  entry.promise = fetch(url, { headers: { accept: "application/json" } }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`GET ${url} failed with HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(`GET ${url} returned a non-JSON response`);
    }

    entry.ttlMs = freshnessOf(response.headers.get("cache-control"));
    return response.json() as Promise<T>;
  });

  cache.set(url, entry);
  // una respuesta fallida no debe quedar cacheada
  entry.promise.catch(() => cache.delete(url));
  return entry.promise as Promise<T>;
}
