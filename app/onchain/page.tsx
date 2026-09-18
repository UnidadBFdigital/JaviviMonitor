import { BitcoinIntelligenceDashboard } from "@/components/onchain/BitcoinIntelligenceDashboard";
import { BitcoinNetworkCard } from "@/components/onchain/BitcoinNetworkCard";
import { EthStatsCard } from "@/components/onchain/EthStatsCard";
import { PageHeader } from "@/components/PageHeader";
import { NetworkActivityChart } from "@/components/onchain/NetworkActivityChart";

export const metadata = { title: "Bitcoin & On-chain — Blockfinity Research" };

export default function OnchainPage() {
  return (
    <>
      <PageHeader
        eyebrow="Market Intelligence"
        title="Bitcoin & On-chain Dashboard"
        subtitle="Costo base, rentabilidad agregada, oferta en exchanges, derivados y liquidaciones en una sola lectura. Cada módulo distingue datos observados de proxies y escenarios."
      />
      <div className="mt-4">
        <BitcoinIntelligenceDashboard />
      </div>
      <div className="mt-7 border-t border-line pt-5">
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-electric">Actividad comparada</p>
          <h2 className="mt-1 text-base font-semibold">Uso de redes</h2>
          <p className="text-xs text-ink-secondary">Bitcoin y Ethereum: actividad observable, sin convertir direcciones en usuarios.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <NetworkActivityChart />
          <BitcoinNetworkCard />
          <EthStatsCard />
        </div>
      </div>
    </>
  );
}
