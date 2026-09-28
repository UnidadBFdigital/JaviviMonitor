import { headers } from "next/headers";
import { NextResponse } from "next/server";

// Cabeceras de caché y compresión de las rutas de datos.
//
// Caché: sin esto el navegador vuelve a pedir cada endpoint en cada
// navegación. Entrar al informe o cambiar de módulo recargaba todo aunque el
// servidor tuviera el dato listo. La ventana del navegador es corta —a lo sumo
// cinco minutos— y la compartida (CDN o proxy) dura lo que el dato: mientras
// revalida, sigue sirviendo lo anterior. Una respuesta fallida nunca se
// cachea: un 502 de una fuente caída no puede quedar pegado en el navegador.
//
// Compresión: Next comprime el HTML, pero no lo que devuelven las rutas de
// datos —salen en chunks, sin content-encoding—, así que los payloads grandes
// (el registro de incidentes son 339 KB, el Builder Radar 222 KB) viajaban en
// crudo. Acá se comprimen los que valen la pena; los chicos no, porque gzip
// les agrega más cabecera y CPU de lo que ahorra.

/** Tope de reutilización sin preguntar en el navegador. */
const BROWSER_MAX_AGE_S = 300;

/** Debajo de esto comprimir no compensa. */
const COMPRESS_MIN_BYTES = 16 * 1024;

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

function cacheHeader(seconds: Freshness): string {
  const browser = Math.min(seconds, BROWSER_MAX_AGE_S);
  return `public, max-age=${browser}, s-maxage=${seconds}, stale-while-revalidate=${seconds}`;
}

/** zlib pedido en tiempo de ejecución: un import estático rompe los bundles
 *  que no son de Node (navegador, runtime edge). */
function gzipSync(body: string): Uint8Array | null {
  const get = typeof process !== "undefined" ? process.getBuiltinModule : undefined;
  if (typeof get !== "function") return null;
  try {
    // nivel 6: el punto donde comprimir más ya cuesta más CPU de lo que ahorra
    return get("node:zlib").gzipSync(body, { level: 6 });
  } catch {
    return null;
  }
}

async function acceptsGzip(): Promise<boolean> {
  try {
    return ((await headers()).get("accept-encoding") ?? "").includes("gzip");
  } catch {
    // fuera de una petición (render estático): se responde sin comprimir
    return false;
  }
}

/**
 * Responde JSON con su frescura declarada y, si es grande, comprimido.
 * `seconds` es la frescura real del dato —el TTL de la fuente más rápida de
 * esa ruta—, no un número al azar.
 */
export async function jsonCached<T>(payload: T, seconds: Freshness, init?: ResponseInit): Promise<NextResponse> {
  const status = init?.status ?? 200;
  if (failed(payload, status)) {
    const response = NextResponse.json(payload, init);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const body = JSON.stringify(payload);
  const headersOut = new Headers(init?.headers);
  headersOut.set("Content-Type", "application/json; charset=utf-8");
  headersOut.set("Cache-Control", cacheHeader(seconds));

  if (body.length >= COMPRESS_MIN_BYTES && (await acceptsGzip())) {
    const gz = gzipSync(body);
    if (gz) {
      headersOut.set("Content-Encoding", "gzip");
      headersOut.set("Content-Length", String(gz.byteLength));
      // la respuesta cambia según lo que acepte el cliente: la caché compartida
      // tiene que guardar una copia por variante
      headersOut.set("Vary", "Accept-Encoding");
      return new NextResponse(gz as BodyInit, { ...init, status, headers: headersOut });
    }
  }

  return new NextResponse(body, { ...init, status, headers: headersOut });
}
