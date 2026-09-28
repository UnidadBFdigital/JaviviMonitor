import { PageHeader } from "@/components/PageHeader";
import { LandscapeView } from "@/components/blockchains/LandscapeView";

export const metadata = { title: "Blockchain Landscape — BBIM" };

export default function LandscapePage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Blockchain Intelligence"
        title="Landscape"
        subtitle="Compara direcciones activas, TVL, stablecoins, volumen DEX, fees y revenue por red. Las métricas en vivo vienen de DeFiLlama; el universo estratégico y su clasificación son curados."
      />
      <LandscapeView />
    </div>
  );
}
