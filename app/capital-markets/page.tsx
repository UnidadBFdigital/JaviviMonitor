import { PageHeader } from "@/components/PageHeader";
import { CapitalMarketsView } from "@/components/capital/CapitalMarketsView";

export const metadata = { title: "Capital Markets — Blockfinity Research" };

export default function CapitalMarketsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Institutional Intelligence"
        title="Capital Markets"
        subtitle="Los vehículos cotizados por los que el capital institucional toma exposición a cripto: ETF al contado y equities del sector. Yahoo Finance publica precio y volumen negociado, no flujos netos de suscripción y rescate — el volumen es un proxy de actividad, no un inflow."
      />
      <CapitalMarketsView />
    </div>
  );
}
