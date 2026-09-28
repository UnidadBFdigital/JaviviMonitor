import { NextResponse } from "next/server";

// Cabeceras de caché de las rutas de datos.
//
// Sin esto el navegador vuelve a pedir cada endpoint en cada navegación: entrar
// al informe o cambiar de módulo recargaba todo aunque el servidor tuviera el
// dato listo. La ventana del navegador es corta —a lo sumo cinco minutos— y la
// compartida (CDN o proxy) dura lo que el dato: mientras revalida, sigue
// sirviendo lo anterior.
//
// Una respuesta fallida nunca se cachea: un 502 de una fuente caída no puede
// quedar pegado en el navegador hasta que venza.

/** Tope de reutilización sin preguntar en el navegador. */
const BROWSER_MAX_AGE_S = 300;

export type Freshness = number;

/** Ventanas típicas, en segundos, para no repetir números mágicos por ruta. */
export const FRESH = {
  minutes5: 300,
  minutes10: 600,
  minutes15: 900,
  minutes30: 1800,
  hour: 3600,
  hours6: 21600,
} as const;

function failed(payload: unknown, status: number): boolean {
  if (status >= 400) return true;
  return typeof payload === "object" && payload !== null && "ok" in payload && (payload as { ok: unknown }).ok === false;
}

/**
 * Responde JSON con la caché declarada. `seconds` es la frescura real del dato
 * —el TTL de la fuente más rápida de esa ruta—, no un número al azar.
 */
export function jsonCached<T>(payload: T, seconds: Freshness, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(payload, init);
  return withCache(response, seconds, failed(payload, init?.status ?? 200));
}

/** La misma cabecera sobre una respuesta ya armada, para payloads largos. */
export function withCache(response: NextResponse, seconds: Freshness, isFailure = false): NextResponse {
  if (isFailure || response.status >= 400) {
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const browser = Math.min(seconds, BROWSER_MAX_AGE_S);
  response.headers.set(
    "Cache-Control",
    `public, max-age=${browser}, s-maxage=${seconds}, stale-while-revalidate=${seconds}`
  );
  return response;
}
