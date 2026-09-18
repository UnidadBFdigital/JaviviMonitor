import { AssetOverviewCard } from "@/components/market/AssetOverviewCard";
import { MarketTickersCard } from "@/components/market/MarketTickersCard";
import { MarketChartsExplorer } from "@/components/market/MarketChartsExplorer";
import { MarketScreenerCard } from "@/components/market/MarketScreenerCard";
import { PageHeader } from "@/components/PageHeader";
import { TickerStrip } from "@/components/terminal/TickerStrip";
import { MarketPerformanceChart } from "@/components/market/MarketPerformanceChart";

export const metadata = { title: "Mercado — Blockfinity Research" };

export default function MercadoPage() {
  return (
    <>
      <PageHeader
        eyebrow="Market Data"
        title="Crypto Markets"
        subtitle="Precio, liquidez, riesgo y rendimiento relativo del mercado cripto."
      />
      <TickerStrip />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <MarketScreenerCard />
        </div>
        <div className="lg:col-span-2">
          <MarketPerformanceChart />
        </div>
        <div className="lg:col-span-2">
          <MarketChartsExplorer />
        </div>
        <AssetOverviewCard />
        <MarketTickersCard />
      </div>
    </>
  );
}
