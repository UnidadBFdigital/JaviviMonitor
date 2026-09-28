import { PageHeader } from "@/components/PageHeader";
import { ReportDocument } from "@/components/report/ReportDocument";

export const metadata = { title: "Blockchain Landscape Report — BBIM" };

export default function InformePage() {
  return (
    <>
      <div className="bf-noprint">
        <PageHeader
          eyebrow="Executive Brief"
          title="Informe descargable"
          subtitle="Blockchain Landscape Report: la foto completa del terminal en el momento en que se genera, lista para exportar a PDF y circular fuera del equipo."
        />
      </div>
      <div className="mt-4">
        <ReportDocument />
      </div>
    </>
  );
}
