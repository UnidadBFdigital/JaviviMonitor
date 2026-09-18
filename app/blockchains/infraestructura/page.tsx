import { PageHeader } from "@/components/PageHeader";
import { NetworkIntelligence } from "@/components/networks/NetworkIntelligence";

export const metadata = { title: "Builder Radar — Blockfinity Research" };

// Cuarta vista de Blockchain Intelligence. Landscape mide actividad y capital,
// Scorecard juzga la red como contraparte institucional y Riesgos mira los
// controles; acá se mira desde el otro lado del mostrador: cuánto cuesta
// construir y operar, dónde se está escribiendo código y qué red conviene
// según el caso de uso.
export default function InfraestructuraPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Blockchain Intelligence"
        title="Builder Radar"
        subtitle="¿En qué red conviene construir? Quince redes medidas con la misma vara: cuánto cuesta usarlas, cuántos usuarios y cuánto capital tienen, qué tan fácil es desarrollar y hacia dónde van. Lo que solo existe para algunas redes se muestra como detalle, nunca dentro de la nota."
      />
      <NetworkIntelligence />
    </div>
  );
}
