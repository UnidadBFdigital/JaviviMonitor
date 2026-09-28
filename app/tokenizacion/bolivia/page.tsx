import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import boliviaOps from "@/data/bolivia-opportunities.json";
import { OpportunityMatrix } from "@/components/charts/OpportunityMatrix";

export const metadata = { title: "Bolivia Opportunities — BBIM" };

/** La prioridad no se escribe en el JSON: se calcula, para que ordenar la
 *  cartera no dependa de una opinión suelta sino de los tres puntajes base. */
function prioridad(o: { potencial: number; madurez: number; viabilidad: number }): number {
  return o.viabilidad * 0.4 + o.potencial * 0.35 + o.madurez * 0.25;
}

function Metric({ label, value }: { label: string; value: number }) {
  const tone = value >= 8 ? "bg-up" : value >= 5 ? "bg-warn" : "bg-down";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-widest text-ink-muted">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-ice">
        <div className={`h-full rounded ${tone}`} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

export default function BoliviaOpportunitiesPage() {
  const { opportunities, asOf } = boliviaOps;
  const ranked = [...opportunities]
    .map((o) => ({ ...o, prioridad: prioridad(o) }))
    .sort((a, b) => b.prioridad - a.prioridad);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Tokenization Hub"
        title="Bolivia Opportunities"
        subtitle="Qué activos bolivianos son tokenizables hoy, cuáles no lo son todavía y por qué. La prioridad no privilegia el activo más grande sino el más ejecutable: un piloto que funciona vale más que una tesis sobre el recurso más valioso del país."
      />

      <div className="rounded-lg border border-line bg-card-raised px-4 py-3">
        <p className="text-xs leading-relaxed text-ink-secondary">
          <span className="font-semibold text-ink">Criterio editorial de Blockfinity</span>, corte a{" "}
          {asOf}. Los tres puntajes base son valoraciones, no mediciones de mercado. La{" "}
          <span className="font-semibold text-ink">prioridad se calcula</span>: 40% viabilidad, 35%
          potencial, 25% madurez — se privilegia deliberadamente lo ejecutable sobre lo grande.
        </p>
      </div>

      {/* Matriz: el mapa de la cartera antes del detalle fila por fila */}
      <section className="bf-reveal">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
          <span className="bf-slash bf-slash-gold" aria-hidden />
          <h2 className="text-sm font-semibold">Matriz de oportunidad</h2>
          <p className="text-[11px] text-ink-muted">
            Dónde empezar, no cómo clasificar — el cuadrante dorado es el que se ejecuta
          </p>
        </div>
        <OpportunityMatrix
          points={ranked.map((o) => ({
            name: o.name,
            x: o.viabilidad,
            y: o.potencial,
            z: o.madurez,
            note: `prioridad ${o.prioridad.toFixed(1)}/10`,
          }))}
          zLabel="Madurez de la infraestructura"
        />
      </section>

      <div className="space-y-4">
        {ranked.map((o, i) => (
          <section key={o.slug} className="rounded-lg border border-line bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-bold tabular-nums text-ink-muted">#{i + 1}</span>
                <h3 className="text-base font-semibold">{o.name}</h3>
                <Link
                  href={`/tokenizacion/clases/${o.assetClass}`}
                  className="text-[11px] text-core underline hover:text-electric"
                >
                  ver clase de activo →
                </Link>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-ink-muted">
                  Prioridad estratégica
                </p>
                <p className="text-xl font-bold tabular-nums leading-none text-electric">
                  {o.prioridad.toFixed(1)}
                  <span className="text-xs font-normal text-ink-muted">/10</span>
                </p>
              </div>
            </div>

            <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">{o.rationale}</p>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="Potencial" value={o.potencial} />
              <Metric label="Madurez" value={o.madurez} />
              <Metric label="Viabilidad" value={o.viabilidad} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-up">
                  Habilitadores
                </p>
                <ul className="space-y-1">
                  {o.habilitadores.map((h) => (
                    <li key={h} className="flex gap-2 text-[12px] leading-relaxed text-ink-secondary">
                      <span className="text-up">+</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-down">
                  Bloqueadores
                </p>
                <ul className="space-y-1">
                  {o.bloqueadores.map((b) => (
                    <li key={b} className="flex gap-2 text-[12px] leading-relaxed text-ink-secondary">
                      <span className="text-down">−</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded border border-electric/40 bg-electric/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-electric">
                Primer paso
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{o.primerPaso}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
