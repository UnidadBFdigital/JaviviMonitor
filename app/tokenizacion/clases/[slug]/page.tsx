import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import assetClasses from "@/data/asset-classes.json";
import caseStudies from "@/data/case-studies.json";
import boliviaOps from "@/data/bolivia-opportunities.json";

export function generateStaticParams() {
  return assetClasses.classes.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = assetClasses.classes.find((x) => x.slug === slug);
  return { title: `${c?.name ?? "Asset Class"} — BBIM` };
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export default async function AssetClassPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = assetClasses.classes.find((x) => x.slug === slug);
  if (!c) notFound();

  const casos = caseStudies.studies.filter((s) => s.assetClass === slug);
  const oportunidad = boliviaOps.opportunities.find((o) => o.assetClass === slug);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Tokenization Hub · Asset Classes"
        title={c.name}
        subtitle={c.whatIsTokenized}
        actions={
          <Link href="/tokenizacion/clases" className="text-[11px] text-core underline hover:text-electric">
            ← Todas las clases
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Madurez
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none">
            {c.maturityScore}
            <span className="text-sm font-normal text-ink-muted">/10</span>
          </p>
          <p className="mt-1.5 text-[11px] text-ink-secondary">{c.maturity}</p>
        </div>
        <div className="rounded-lg border border-line bg-card px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Relevancia para Bolivia
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-secondary">
            {c.boliviaRelevance}
          </p>
        </div>
        <div className="rounded-lg border border-warn/40 bg-warn/5 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-warn">
            Cuello de botella
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-secondary">{c.bottleneck}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Casos de uso">
          <ul className="space-y-1.5">
            {c.useCases.map((u) => (
              <li key={u} className="flex gap-2 text-[13px] leading-relaxed text-ink-secondary">
                <span className="text-electric">·</span>
                {u}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Infraestructura habilitante">
          <p className="text-[13px] leading-relaxed text-ink-secondary">{c.infrastructure}</p>
          <p className="mt-3 border-t border-line/60 pt-2 text-[11px] leading-relaxed text-ink-muted">
            Todas estas piezas son off-chain. La blockchain entra recién después, a registrar lo que
            estas capas ya garantizaron.
          </p>
        </Panel>
      </div>

      {casos.length > 0 && (
        <Panel title="Casos de referencia en esta clase">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {casos.map((s) => (
              <div key={s.name} className="rounded border border-line/70 bg-card-raised p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-semibold">{s.name}</h4>
                  <span className="text-[10px] text-ink-muted">{s.country}</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {s.issuer} · {s.blockchain}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">{s.lesson}</p>
              </div>
            ))}
          </div>
          <p className="mt-3">
            <Link href="/tokenizacion/casos" className="text-[11px] text-core underline hover:text-electric">
              Ver la biblioteca completa de casos →
            </Link>
          </p>
        </Panel>
      )}

      {oportunidad && (
        <Panel title={`Oportunidad en Bolivia — ${oportunidad.name}`}>
          <p className="text-[13px] leading-relaxed text-ink-secondary">{oportunidad.rationale}</p>
          <div className="mt-3 rounded border border-line/70 bg-card-raised p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-electric">
              Primer paso recomendado
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
              {oportunidad.primerPaso}
            </p>
          </div>
          <p className="mt-3">
            <Link
              href="/tokenizacion/bolivia"
              className="text-[11px] text-core underline hover:text-electric"
            >
              Ver el panel completo de oportunidades en Bolivia →
            </Link>
          </p>
        </Panel>
      )}
    </div>
  );
}
