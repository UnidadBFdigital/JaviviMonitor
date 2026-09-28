import { PageHeader } from "@/components/PageHeader";
import { ScorecardView } from "@/components/blockchains/ScorecardView";

export const metadata = { title: "Scorecard & BBI — BBIM" };

export default function ScorecardPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Blockchain Intelligence"
        title="Scorecard & BBI"
        subtitle="BBI v2: actividad observable, evaluación editorial y cobertura de datos. Compara rankings por objetivo y consulta qué aporta cada categoría a la nota de una red."
      />
      <ScorecardView />
    </div>
  );
}
