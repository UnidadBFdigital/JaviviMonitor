"use client";

// Varias cards de una misma vista consumen el mismo endpoint (por ejemplo
// la portada y el hub leen ambos /api/tokenization/rwa). Sin esto, cada uno
// dispara su propia petición idéntica en cada carga.
//
// Deduplica por URL: comparte la petición en vuelo y reutiliza la respuesta
// durante una ventana corta. El TTL real de los datos vive en el servidor
// (lib/cache.ts); acá solo se evita el duplicado dentro de la misma vista.

const WINDOW_MS = 30 * 1000;

type Cached = { at: number; promise: Promise<unknown> };

const cache = new Map<string, Cached>();

export function fetchShared<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < WINDOW_MS) {
    return hit.promise as Promise<T>;
  }
  const promise = fetch(url, { headers: { accept: "application/json" } }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`GET ${url} failed with HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(`GET ${url} returned a non-JSON response`);
    }

    return response.json() as Promise<T>;
  });
  cache.set(url, { at: Date.now(), promise });
  // una respuesta fallida no debe quedar cacheada
  promise.catch(() => cache.delete(url));
  return promise;
}
