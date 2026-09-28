import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { TvlHistoryChart } from "@/components/defi/TvlHistoryChart";
import { TopProtocolsCard } from "@/components/defi/TopProtocolsCard";
import { RevenueCard } from "@/components/defi/RevenueCard";
import { MoversCard } from "@/components/defi/MoversCard";
import { DexVolumeCard } from "@/components/defi/DexVolumeCard";
import { IncomeStatementCard } from "@/components/defi/IncomeStatementCard";
import {
  RevenueVsTvlBubble,
  ChainTreemapCard,
  DexRankingCard,
} from "@/components/defi/AnalyticsCards";

export const metadata = { title: "Protocol Analytics — BBIM" };

export default function DefiPage() {
  return (
    <>
      <PageHeader
        eyebrow="Market Data"
        title="Protocol Analytics"
        subtitle="TVL, revenue y volumen por protocolo y por red — quién captura valor en DeFi."
        actions={
          <Link href="/defi/yields" className="text-[11px] text-core underline hover:text-electric">
            Ver rendimientos DeFi →
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IncomeStatementCard />
        <RevenueVsTvlBubble />
        <ChainTreemapCard />
        <DexRankingCard />
        <TvlHistoryChart />
        <TopProtocolsCard />
        <RevenueCard />
        <MoversCard />
        <div className="lg:col-span-2">
          <DexVolumeCard />
        </div>
      </div>
    </>
  );
}
