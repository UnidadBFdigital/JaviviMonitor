import registry from "@/data/networks.json";
import { getAssetHistory } from "@/lib/sources/coingecko";
import { getChainToken } from "@/lib/sources/defillama";
import { sliceDays } from "@/lib/historySeries";
import type { HistoryPoint } from "@/lib/historyTypes";

// Precio del token de cada red del universo de Build & Cost, a demanda: solo
// se consulta cuando alguien elige esa métrica en «Evolución de la red». El
// token sale de DeFiLlama (/v2/chains, ya cacheado) y la serie de CoinGecko,
// con la misma entrada de caché que usa la ficha lateral.

/** Mismo horizonte que las series de red del panel. */
const WINDOW_DAYS = 90;
/** CoinGecko demo admite 30 llamadas por minuto: de a tres redes por vez. */
const CONCURRENCY = 3;

export type NetworkPriceSeries = { symbol: string | null; points: HistoryPoint[] };

export type NetworkPricesPayload = {
  ok: true;
  source: string;
  fetchedAt: string;
  stale: boolean;
  series: Record<string, NetworkPriceSeries>;
  /** redes sin serie y por qué: sin token propio, o la fuente no respondió */
  missing: { id: string; name: string; reason: string }[];
};

type RegistryNetwork = { id: string; name: string; keys: { llama: string | null } };

type Outcome =
  | { id: string; ok: true; symbol: string | null; points: HistoryPoint[]; fetchedAt: string; stale: boolean }
  | { id: string; name: string; ok: false; reason: string };

async function priceOf(network: RegistryNetwork): Promise<Outcome> {
  const miss = (reason: string): Outcome => ({ id: network.id, name: network.name, ok: false, reason });
  if (!network.keys.llama) return miss("sin equivalente en DeFiLlama");
  const token = await getChainToken(network.keys.llama);
  if (!token.ok) return miss("DeFiLlama no respondió");
  if (!token.data.geckoId) return miss("sin token propio asociado");
  const history = await getAssetHistory(token.data.geckoId, 365);
  if (!history.ok || history.data.prices.length < 2) return miss("CoinGecko no respondió");
  return {
    id: network.id,
    ok: true,
    symbol: token.data.symbol,
    points: sliceDays(history.data.prices, WINDOW_DAYS),
    fetchedAt: history.fetchedAt,
    stale: history.stale,
  };
}

export async function getNetworkPrices(): Promise<NetworkPricesPayload> {
  const networks = registry.networks as RegistryNetwork[];
  const outcomes: Outcome[] = [];
  for (let i = 0; i < networks.length; i += CONCURRENCY) {
    outcomes.push(...(await Promise.all(networks.slice(i, i + CONCURRENCY).map(priceOf))));
  }

  const series: Record<string, NetworkPriceSeries> = {};
  const missing: NetworkPricesPayload["missing"] = [];
  let fetchedAt: string | null = null;
  let stale = false;
  for (const outcome of outcomes) {
    if (outcome.ok) {
      series[outcome.id] = { symbol: outcome.symbol, points: outcome.points };
      if (!fetchedAt || outcome.fetchedAt > fetchedAt) fetchedAt = outcome.fetchedAt;
      stale ||= outcome.stale;
    } else {
      missing.push({ id: outcome.id, name: outcome.name, reason: outcome.reason });
    }
  }

  return {
    ok: true,
    source: "CoinGecko · token según DeFiLlama",
    fetchedAt: fetchedAt ?? new Date().toISOString(),
    stale,
    series,
    missing,
  };
}
