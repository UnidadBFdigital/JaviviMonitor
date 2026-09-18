// Tools del agente de IA — reutilizan las mismas funciones de lib/sources.
// Cada tool devuelve solo campos relevantes (los módulos ya recortan el
// payload), lo que mantiene bajo el costo de tokens por corrida.

import type Anthropic from "@anthropic-ai/sdk";
import {
  getTopProtocols,
  getTvlHistory,
  getProtocolRevenue,
  getMovers,
  getDexOverview,
  getChainsTvl,
} from "@/lib/sources/defillama";
import { getAssetOverview } from "@/lib/sources/messari";
import { getTickers, getDailyCandles } from "@/lib/sources/cryptocom";
import { getEthStats } from "@/lib/sources/blockscout";
import { getHeadlines, getInstitutionalNews } from "@/lib/sources/news";
import { getDexTrades } from "@/lib/sources/dune";
import { getSmartMoneyNetflow } from "@/lib/sources/nansen";
import { getGlobalMarket } from "@/lib/sources/coingecko";
import { getFearGreed } from "@/lib/sources/feargreed";
import { getStablecoins } from "@/lib/sources/stablecoins";
import { getBoliviaNews } from "@/lib/sources/bolivianews";

// El orden de esta lista es fijo: cambiarlo invalida el prompt cache.
export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_top_protocols",
    description:
      "Top 10 protocolos DeFi por TVL (excluye CEX), con cambio 24h y 7d. Fuente: DeFiLlama.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_tvl_history",
    description:
      "Histórico diario del TVL total en DeFi (todas las chains), en USD. Fuente: DeFiLlama.",
    input_schema: {
      type: "object",
      properties: {
        dias: { type: "integer", description: "Días hacia atrás (7-365). Usar 30 salvo que se necesite más.", minimum: 7, maximum: 365 },
      },
      required: [],
    },
  },
  {
    name: "get_protocol_revenue",
    description:
      "Top 10 protocolos por revenue diario, con acumulado 7d y 30d. Fuente: DeFiLlama.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_defi_movers",
    description:
      "Protocolos DeFi con mayor crecimiento y mayor caída de TVL en 7d (solo TVL > $50M). Fuente: DeFiLlama.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_asset_overview",
    description:
      "Precio, cambio 24h, volumen, market cap y dominancia de BTC y ETH. Fuente: Messari.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_spot_tickers",
    description:
      "Precio spot, cambio 24h, rango y volumen de BTC, ETH, SOL y XRP contra USDT. Fuente: Crypto.com Exchange.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_btc_daily_candles",
    description:
      "Cierres diarios de BTC/USDT. Fuente: Crypto.com Exchange.",
    input_schema: {
      type: "object",
      properties: {
        dias: { type: "integer", description: "Días hacia atrás (7-90). Usar 30 salvo que se necesite más.", minimum: 7, maximum: 90 },
      },
      required: [],
    },
  },
  {
    name: "get_eth_network_stats",
    description:
      "Actividad de la red Ethereum: transacciones hoy, gas promedio, precio ETH, tiempo de bloque. Fuente: Blockscout.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_news_headlines",
    description:
      "Titulares cripto recientes con medio y fecha. Fuentes: CoinDesk, Cointelegraph, Decrypt (RSS).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_dex_trades",
    description:
      "Últimos trades DEX de una query pública de Dune (muestra puntual, no agregado). Fuente: Dune Analytics.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_smart_money_netflow",
    description:
      "Netflow hacia tokens por wallets etiquetadas como smart money (fondos, traders destacados) en Ethereum y Solana. Fuente: Nansen. Puede no estar disponible.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_global_market",
    description:
      "Market cap total del mercado cripto, volumen 24h, dominancia de BTC y ETH, y variación 24h del market cap. Fuente: CoinGecko.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_fear_greed",
    description:
      "Índice Fear & Greed (0-100) con su clasificación y el histórico de 30 días. Fuente: Alternative.me.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_stablecoins",
    description:
      "Top stablecoins por circulante en USD, con mecanismo de peg, variación 7d y distribución por chain. Fuente: DeFiLlama Stablecoins.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_dex_overview",
    description:
      "Volumen agregado de DEXs en 24h, variación 7d contra 7d y ranking de los principales DEXs. Fuente: DeFiLlama.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_chains_tvl",
    description:
      "TVL por blockchain (top 15), para analizar distribución y rotación de capital entre chains. Fuente: DeFiLlama.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_institutional_news",
    description:
      "Titulares priorizados por relevancia institucional B2B (banca, stablecoins, RWA, tokenización, custodia, pagos, CBDC, regulación), con categorías y entidades detectadas. Excluye ruido retail. Fuentes: The Block, Blockworks, CoinDesk, Cointelegraph, Decrypt.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_bolivia_news",
    description:
      "Titulares de prensa boliviana sobre cripto, dólar, tipo de cambio y regulación financiera (BCB, ASFI). Fuente: Google News Bolivia.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  const dias = typeof input.dias === "number" ? input.dias : undefined;
  try {
    switch (name) {
      case "get_top_protocols":
        return JSON.stringify(await getTopProtocols(10));
      case "get_tvl_history":
        return JSON.stringify(await getTvlHistory(Math.min(dias ?? 30, 365)));
      case "get_protocol_revenue":
        return JSON.stringify(await getProtocolRevenue(10));
      case "get_defi_movers":
        return JSON.stringify(await getMovers(5));
      case "get_asset_overview":
        return JSON.stringify(await getAssetOverview());
      case "get_spot_tickers":
        return JSON.stringify(await getTickers());
      case "get_btc_daily_candles":
        return JSON.stringify(await getDailyCandles("BTC_USDT", Math.min(dias ?? 30, 90)));
      case "get_eth_network_stats":
        return JSON.stringify(await getEthStats());
      case "get_news_headlines":
        return JSON.stringify(await getHeadlines(12));
      case "get_dex_trades":
        return JSON.stringify(await getDexTrades(8));
      case "get_smart_money_netflow":
        return JSON.stringify(await getSmartMoneyNetflow(10));
      case "get_global_market":
        return JSON.stringify(await getGlobalMarket());
      case "get_fear_greed":
        return JSON.stringify(await getFearGreed());
      case "get_stablecoins":
        return JSON.stringify(await getStablecoins(8));
      case "get_dex_overview":
        return JSON.stringify(await getDexOverview());
      case "get_chains_tvl":
        return JSON.stringify(await getChainsTvl(15));
      case "get_institutional_news":
        return JSON.stringify(await getInstitutionalNews(15));
      case "get_bolivia_news":
        return JSON.stringify(await getBoliviaNews(12));
      default:
        return JSON.stringify({ ok: false, error: `tool desconocida: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ ok: false, error: String(err) });
  }
}
