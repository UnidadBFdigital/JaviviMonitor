import { getAllChainsTvl } from "./sources/defillama";
import { getStablecoinSupplyByChain } from "./sources/stablecoins";
import { getChainActivityMetrics } from "./sources/defillamaDashboard";
import { scoreNetworks, type Network, type Weights } from "./bbi";
import blockchains from "@/data/blockchains.json";

/** Único conjunto de insumos BBI para terminal, índices e informe PDF. */
export async function getBlockchainSnapshot() {
  const [chains, stablecoins, activity] = await Promise.all([
    getAllChainsTvl(), getStablecoinSupplyByChain(), getChainActivityMetrics(),
  ]);
  const weights = blockchains.weights as Weights;
  return {
    chains, stablecoins, activity, weights, asOf: blockchains.asOf,
    networks: scoreNetworks(blockchains.networks as Network[], chains.ok ? chains.data : [], weights,
      stablecoins.ok ? stablecoins.data : [], activity.ok ? activity.data : []),
  };
}
