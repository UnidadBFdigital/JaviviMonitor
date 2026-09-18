import { NextRequest, NextResponse } from "next/server";

// Password gate para deploys: si APP_PASSWORD está definida, toda la app
// pide HTTP Basic Auth (usuario: blockfinity). Con APP_PASSWORD vacía
// (desarrollo local) no se pide nada.

const USER = "blockfinity";

/** Comparación sin cortocircuito, para no filtrar el largo del prefijo correcto. */
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  // se comparan siempre todos los bytes del más largo
  let diff = ea.length ^ eb.length;
  const len = Math.max(ea.length, eb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  }
  return diff === 0;
}

function decodeBasic(header: string): string | null {
  try {
    const bytes = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
    // las credenciales pueden traer caracteres no ASCII
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    // base64 inválido: credencial rechazada, no error del servidor
    return null;
  }
}

function unauthorized() {
  return new NextResponse("Acceso restringido", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Blockfinity Research", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorized();

  const decoded = decodeBasic(auth.slice(6).trim());
  if (decoded === null) return unauthorized();

  // el password puede contener ":", así que solo se parte en el primero
  const sep = decoded.indexOf(":");
  if (sep < 0) return unauthorized();
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);

  // se evalúan ambos para no cortocircuitar en el usuario
  const okUser = safeEqual(user, USER);
  const okPass = safeEqual(pass, password);
  return okUser && okPass ? NextResponse.next() : unauthorized();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
