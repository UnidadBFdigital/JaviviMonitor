import { PageHeader } from "@/components/PageHeader";
import { CaseStudiesGrid } from "@/components/tokenization/CaseStudiesGrid";
import caseStudies from "@/data/case-studies.json";

export const metadata = { title: "Global Case Studies — BBIM" };

export default function CaseStudiesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Tokenization Hub"
        title="Global Case Studies"
        subtitle="Proyectos de tokenización en producción, con el modelo que usan y la lectura que deja cada uno. Los tamaños de los proyectos que cotizan en DeFiLlama se leen en vivo; el resto lleva la cifra curada con su fuente."
      />

      <div className="rounded-lg border border-line bg-card-raised px-4 py-2.5">
        <p className="text-xs leading-relaxed text-ink-secondary">
          Fichas verificadas contra fuente primaria el {caseStudies.verifiedOn}. Cada una enlaza la
          suya. Se amplía editando{" "}
          <code className="rounded bg-ice px-1">data/case-studies.json</code>.
        </p>
      </div>

      <CaseStudiesGrid />
    </div>
  );
}
