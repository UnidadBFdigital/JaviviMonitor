// Next ejecuta `register()` una vez por instancia del servidor, antes de
// atender la primera petición. Es el lugar para precalentar la caché.
//
// En producción corre siempre. En desarrollo se reinicia el servidor muchas
// veces al día, así que solo corre si se pide con BF_WARMUP=1: no tiene
// sentido descargar 20 MB en cada recompilación cuando la copia en disco ya
// responde.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // la limpieza corre siempre: es barata y evita que la carpeta crezca sola
  const { pruneSnapshots } = await import("@/lib/cache");
  const borrados = await pruneSnapshots();
  if (borrados > 0) console.log(`[BBIM] copias en disco vencidas borradas: ${borrados}`);

  const enDesarrollo = process.env.NODE_ENV !== "production";
  if (enDesarrollo && process.env.BF_WARMUP !== "1") return;

  const { scheduleWarmup } = await import("@/lib/warmup");
  scheduleWarmup();
}
