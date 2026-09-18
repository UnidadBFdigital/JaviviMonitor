import { PageHeader } from "@/components/PageHeader";
import { IndicesTerminal } from "@/components/indices/IndicesTerminal";

export const metadata = { title: "Blockfinity Indices — Blockfinity Research" };

export default function IndicesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Blockfinity Indices"
        title="Índices propietarios"
        subtitle="Los índices que Blockfinity calcula sobre datos públicos. Son activo intelectual: lo que permite pasar de citar la cifra de otro a publicar la propia. Cada uno declara su metodología completa y sus insumos — sin caja negra."
      />

      <div className="rounded-lg border border-line bg-card-raised px-4 py-2.5">
        <p className="text-xs leading-relaxed text-ink-secondary">
          Todos se recalculan en cada carga desde fuentes en vivo. Un índice muestra sparkline
          únicamente cuando existe serie histórica real de sus insumos; cuando no la hay, lo dice en
          vez de dibujar una línea inventada. Para agregar un índice nuevo basta con declararlo en{" "}
          <code className="rounded bg-ice px-1">lib/indices.ts</code>: el registro no toca los
          existentes.
        </p>
      </div>

      <IndicesTerminal />
    </div>
  );
}
