import tokenizationJson from "@/data/tokenization.json";
import { RwaSectorsCard } from "@/components/tokenization/RwaSectorsCard";
import { RwaCoverageNote } from "@/components/tokenization/RwaCoverageNote";
import { InfrastructureFlow } from "@/components/tokenization/InfrastructureFlow";
import Link from "next/link";
import { RwaProtocolsCard } from "@/components/tokenization/RwaProtocolsCard";
import { PageHeader } from "@/components/PageHeader";
import { RwaMarketView } from "@/components/tokenization/RwaMarketView";
import { RwaHeadlineMetrics } from "@/components/tokenization/RwaHeadlineMetrics";

export const metadata = { title: "Tokenization Intelligence — BBIM" };

function fmtUsd(v: number | null): string {
  if (v === null) return "No disponible";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

export default function TokenizacionPage() {
  const { projects } = tokenizationJson;

  return (
    <div className="space-y-4">
      <div>
        <PageHeader
          eyebrow="Institutional Intelligence"
          title="Tokenization Hub"
          subtitle={
            <>
              Capitalización RWA oficial de DeFiLlama, TVL de protocolos por sector y proyectos
              curados con fuente y fecha de referencia. Se amplía editando{" "}
              <code className="rounded bg-ice px-1">data/tokenization.json</code>.
            </>
          }
        />
      </div>

      <RwaHeadlineMetrics />

      {/* submódulos del hub */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            href: "/tokenizacion/clases",
            title: "Asset Classes",
            desc: "Qué se tokeniza en cada clase de activo y dónde está el cuello de botella",
          },
          {
            href: "/tokenizacion/casos",
            title: "Global Case Studies",
            desc: "Proyectos en producción, su modelo y la lectura que deja cada uno",
          },
          {
            href: "/tokenizacion/bolivia",
            title: "Bolivia Opportunities",
            desc: "Qué activos bolivianos son tokenizables hoy y cuáles todavía no",
          },
        ].map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-lg border border-line bg-card p-4 transition-colors hover:border-electric/50"
          >
            <p className="text-sm font-semibold group-hover:text-electric">{m.title} →</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{m.desc}</p>
          </Link>
        ))}
      </div>

      <RwaCoverageNote />

      {/* mercado RWA en vivo, por sector */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[5fr_7fr]">
        <RwaSectorsCard />
        <RwaProtocolsCard />
      </div>

      <RwaMarketView />

      <InfrastructureFlow />

      {/* proyectos */}
      <div className="flex items-center gap-3 pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
          Proyectos verificados
        </p>
        <div className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {projects.map((p) => (
          <section key={p.name} className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{p.name}</h3>
              <span className="rounded bg-electric/15 px-1.5 py-0.5 text-[10px] text-electric">
                {p.category}
              </span>
            </div>
            <dl className="mt-2 space-y-1.5 text-xs">
              {(
                [
                  ["Emisor", p.issuer],
                  ["Activo", p.asset],
                  ["Blockchain", p.blockchain],
                  ["Valor tokenizado", `${fmtUsd(p.valueUsd)} (al ${p.valueAsOf})`],
                  ["Custodio", p.custodian],
                  ["Jurisdicción", p.jurisdiction],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-ink-muted">{k}</dt>
                  <dd className="text-right text-ink-secondary">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px]">
              <a
                href={p.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-core underline hover:text-electric"
              >
                {p.sourceName}
              </a>
            </p>
          </section>
        ))}
      </div>

      <p className="text-[11px] text-ink-muted">
        El mapa mundial por jurisdicción se habilita cuando el dataset cubra más jurisdicciones —
        hoy todas las entradas verificadas son de EE.UU. y un mapa sería engañoso.
      </p>
    </div>
  );
}
