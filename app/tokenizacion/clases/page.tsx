import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import assetClasses from "@/data/asset-classes.json";

export const metadata = { title: "Asset Classes — Blockfinity Research" };

function MaturityBar({ score }: { score: number }) {
  const tone = score >= 8 ? "bg-up" : score >= 5 ? "bg-warn" : "bg-down";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded bg-ice">
        <div className={`h-full rounded ${tone}`} style={{ width: `${score * 10}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-ink-secondary">{score}/10</span>
    </div>
  );
}

export default function AssetClassesPage() {
  const { classes, asOf } = assetClasses;
  const ordenadas = [...classes].sort((a, b) => b.maturityScore - a.maturityScore);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Tokenization Hub"
        title="Asset Classes"
        subtitle="Qué se tokeniza realmente en cada clase de activo —casi nunca el activo, sino un derecho verificable sobre él—, qué infraestructura exige y dónde está el cuello de botella que hace fracasar los proyectos."
      />

      <div className="rounded-lg border border-line bg-card-raised px-4 py-2.5">
        <p className="text-xs leading-relaxed text-ink-secondary">
          Las lecturas de madurez son <span className="font-semibold text-ink">criterio editorial
          de Blockfinity</span> con corte a {asOf}, no una métrica de mercado. Las cifras de tamaño
          que aparecen en el hub vienen de DeFiLlama en vivo y están señaladas como tales.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ordenadas.map((c) => (
          <Link
            key={c.slug}
            href={`/tokenizacion/clases/${c.slug}`}
            className="group flex flex-col rounded-lg border border-line bg-card p-4 transition-colors hover:border-electric/50"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold group-hover:text-electric">{c.name}</h3>
              <span className="rounded bg-ice px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-ink-secondary">
                {c.icon}
              </span>
            </div>

            <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
              {c.whatIsTokenized}
            </p>

            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                Madurez
              </p>
              <MaturityBar score={c.maturityScore} />
              <p className="text-[11px] text-ink-secondary">{c.maturity}</p>
            </div>

            <p className="mt-3 border-t border-line/60 pt-2 text-[11px] leading-relaxed text-ink-muted">
              <span className="font-semibold text-warn">Cuello de botella:</span> {c.bottleneck}
            </p>

            <span className="mt-3 text-[11px] text-core group-hover:text-electric">
              Ver métricas y casos de uso →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
