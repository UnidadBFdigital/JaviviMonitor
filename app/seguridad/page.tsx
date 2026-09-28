import { PageHeader } from "@/components/PageHeader";
import { SecurityDashboard } from "@/components/security/SecurityDashboard";

export const metadata = { title: "Exploits & Seguridad — BBIM" };

export default function SeguridadPage() {
  return (
    <>
      <PageHeader
        eyebrow="Market Intelligence"
        title="Exploits & Seguridad"
        subtitle="Registro de ataques confirmados a protocolos DeFi, puentes, exchanges y wallets: cuándo ocurrió cada uno, cuánto se llevaron, en qué redes y por qué falló. Todos los filtros gobiernan la vista completa."
      />
      <div className="mt-4">
        <SecurityDashboard />
      </div>
    </>
  );
}
