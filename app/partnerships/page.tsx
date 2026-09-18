import partnershipsJson from "@/data/partnerships.json";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Institutional Partnerships — Blockfinity Research" };

const STATUS_STYLE: Record<string, string> = {
  Activo: "bg-up/15 text-up",
  Anunciado: "bg-electric/15 text-electric",
  "En trámite": "bg-warn/15 text-warn",
};

export default function PartnershipsPage() {
  const items = [...partnershipsJson.partnerships].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <div>
        <PageHeader
          eyebrow="Research Lab"
          title="Partnership Tracker"
          subtitle={
            <>
              Alianzas y despliegues institucionales curados — solo entradas con fuente verificable.
              Se amplía editando <code className="rounded bg-ice px-1">data/partnerships.json</code>.
            </>
          }
        />
      </div>

      {/* Timeline */}
      <div className="relative ml-3 border-l border-line pl-6">
        {items.map((p) => (
          <div key={`${p.companyA}-${p.date}`} className="relative mb-4 last:mb-0">
            <span className="absolute -left-[31px] top-4 h-2.5 w-2.5 rounded-full border-2 border-card bg-electric" />
            <div className="rounded-lg border border-line bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {p.companyA}
                  {p.companyB !== "—" && <span className="text-ink-muted"> × </span>}
                  {p.companyB !== "—" && p.companyB}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_STYLE[p.status] ?? "bg-ice text-ink-secondary"}`}
                >
                  {p.status}
                </span>
                <span className="text-[11px] tabular-nums text-ink-muted">{p.date}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{p.useCase}</p>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Blockchain: {p.blockchain} ·{" "}
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-core underline hover:text-electric"
                >
                  {p.sourceName}
                </a>
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-ink-muted">
        El grafo de red de entidades se habilita cuando el dataset curado supere ~15 alianzas —
        con {items.length} entradas, la vista de timeline es más legible.
      </p>
    </div>
  );
}
