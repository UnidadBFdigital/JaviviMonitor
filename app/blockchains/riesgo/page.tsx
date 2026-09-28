import { PageHeader } from "@/components/PageHeader";
import { RiskView } from "@/components/blockchains/RiskView";

export const metadata = { title: "Risk Profiles — BBIM" };

export default function RiskPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Blockchain Intelligence"
        title="Risk Profiles"
        subtitle="Perfil de riesgo por blockchain para Compliance: modelo de trazabilidad, mecanismos de privacidad, capacidad de monitoreo y exposición normativa. Es el insumo para diseñar políticas AML diferenciadas por red en vez de una política única para todo el ecosistema."
      />
      <RiskView />
    </div>
  );
}
