import { getGlobalMarket } from "@/lib/sources/coingecko";
import { getAllChainsTvl, getDexOverview, getProtocolRevenue, getTvlHistory, protocolsIndex } from "@/lib/sources/defillama";
import { getChainActivityMetrics } from "@/lib/sources/defillamaDashboard";
import { getRwaDashboardMetrics } from "@/lib/sources/defillamaRwa";
import { getYieldUniverse } from "@/lib/sources/defillamaYields";
import { getStablecoins, getStablecoinSupplyByChain } from "@/lib/sources/stablecoins";
import { buildNetworks } from "@/lib/networks/build";

// Precalentado de las claves caras al arrancar el servidor.
//
// La caché ya sirve el dato vencido mientras refresca, así que nadie espera
// por un TTL cumplido. Lo que sí se paga es la primerísima carga de cada
// clave: un proceso nuevo sin copia en disco. Esto la adelanta al arranque,
// fuera del camino de cualquier usuario.
//
// Va en serie y en orden de costo: son descargas de varios MB contra
// proveedores con límites. Dispararlas todas juntas sería exactamente la
// ráfaga que la caché existe para evitar.

type Task = { name: string; run: () => Promise<unknown> };

const TASKS: Task[] = [
  { name: "protocolos", run: protocolsIndex },
  { name: "TVL por red", run: getAllChainsTvl },
  { name: "TVL histórico", run: getTvlHistory },
  { name: "stablecoins", run: getStablecoins },
  { name: "stablecoins por red", run: getStablecoinSupplyByChain },
  { name: "mercado global", run: getGlobalMarket },
  { name: "revenue", run: getProtocolRevenue },
  { name: "DEX", run: getDexOverview },
  { name: "panel de cadenas", run: getChainActivityMetrics },
  { name: "dashboard RWA", run: getRwaDashboardMetrics },
  { name: "universo de yields", run: getYieldUniverse },
  { name: "Builder Radar", run: buildNetworks },
];

let started = false;

/**
 * Llena la caché en segundo plano. Un fallo no interrumpe al resto: la vista
 * que dependa de esa fuente la pedirá igual y verá su error como siempre.
 */
export async function warmup(): Promise<void> {
  if (started) return;
  started = true;

  const t0 = Date.now();
  let ok = 0;
  for (const task of TASKS) {
    try {
      await task.run();
      ok += 1;
    } catch {
      // el precalentado es oportunista: lo que falle se reintenta cuando alguien lo pida
    }
  }
  console.log(`[BBIM] caché precalentada: ${ok}/${TASKS.length} fuentes en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

/** Minutos entre repasos, o 0 para no repetir. */
function intervalMinutes(): number {
  const raw = Number(process.env.BF_WARMUP_INTERVAL_MIN);
  return Number.isFinite(raw) && raw >= 5 ? raw : 0;
}

/**
 * Arranca el precalentado y, si se configuró un intervalo, lo repite. Sin
 * intervalo el refresco queda en manos de la caché, que ya recarga por detrás
 * cuando alguien pide un dato vencido.
 */
export function scheduleWarmup(): void {
  void warmup();
  const minutes = intervalMinutes();
  if (minutes === 0) return;
  const timer = setInterval(() => {
    started = false;
    void warmup();
  }, minutes * 60 * 1000);
  // no debe impedir que el proceso termine
  timer.unref?.();
}
