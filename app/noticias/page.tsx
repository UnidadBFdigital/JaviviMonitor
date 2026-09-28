import { InstitutionalNewsCard, RegulatoryNewsCard } from "@/components/news/InstitutionalNewsCard";
import { NewsCard } from "@/components/news/NewsCard";
import { InstitutionalRadar } from "@/components/terminal/InstitutionalRadar";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "News B2B — BBIM" };

export default function NoticiasPage() {
  return (
    <div className="space-y-4">
      <div>
        <PageHeader
          eyebrow="Research Lab"
          title="News B2B"
          subtitle="Priorización institucional: banca, stablecoins, RWA, custodia, pagos, CBDC y regulación. Se filtra el ruido retail (predicciones de precio, memecoins, influencers)."
        />
      </div>

      <InstitutionalRadar />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <InstitutionalNewsCard limit={14} />
        <div className="space-y-4">
          <RegulatoryNewsCard />
          <NewsCard />
        </div>
      </div>
    </div>
  );
}
