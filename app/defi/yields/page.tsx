import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { YieldExplorer } from "@/components/yields/YieldExplorer";

export const metadata = { title: "DeFi Yields — Blockfinity Research" };

// Rendimientos DeFi para quien quiere hacer rendir un activo: prestar, hacer
// staking, proveer liquidez, tasa fija o vaults, con histórico, plazos y
// señales de riesgo. Protocol Analytics mira quién captura valor; esta vista
// mira cuánto le deja cada protocolo a quien deposita.
export default function YieldsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Market Intelligence"
        title="DeFi Yields"
        subtitle="¿Dónde rinde tu dinero en DeFi y qué riesgo asumís? Rendimientos para prestar, hacer staking, proveer liquidez y más, con su histórico, plazos y señales de riesgo."
        actions={
          <Link href="/defi" className="text-[11px] text-core underline hover:text-electric">
            ← Protocol Analytics
          </Link>
        }
      />
      <YieldExplorer />
    </div>
  );
}
