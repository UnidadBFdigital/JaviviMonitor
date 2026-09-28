import { PageHeader } from "@/components/PageHeader";
import { FanTokensView } from "@/components/fan/FanTokensView";

export const metadata = { title: "Fan Token Analytics — BBIM" };

export default function FanTokensPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Research Lab"
        title="Fan Token Analytics"
        subtitle="Los fan tokens leídos como caso de tokenización de comunidades, no como entretenimiento: cuánto capitaliza cada competencia, cuánta liquidez real tiene y qué clubes concentran la actividad. Insumo para clubes, federaciones y sponsors."
      />
      <FanTokensView />
    </div>
  );
}
