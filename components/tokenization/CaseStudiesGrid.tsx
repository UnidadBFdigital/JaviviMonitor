"use client";

import { formatUsdCompact } from "@/lib/format";
import caseStudies from "@/data/case-studies.json";
import { useRwa } from "./useRwa";

// Biblioteca de casos. Los tamaños de los proyectos que cotizan en DeFiLlama
// se leen en vivo por llamaName; el resto muestra la nota curada. Nunca se
// escribe un tamaño a mano para un proyecto que la fuente sí publica.

const STATUS_STYLE: Record<string, string> = {
  "En producción": "bg-up/15 text-up",
  "En producción con oferta pública autorizada": "bg-up/15 text-up",
  Piloto: "bg-electric/15 text-electric",
  Anunciado: "bg-warn/15 text-warn",
};

export function CaseStudiesGrid() {
  const { data } = useRwa();

  const tvlByName = new Map<string, number>();
  if (data?.source.ok) {
    for (const p of data.protocols) tvlByName.set(p.name.toLowerCase(), p.tvlUsd);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {caseStudies.studies.map((s) => {
        const live = s.llamaName ? tvlByName.get(s.llamaName.toLowerCase()) : undefined;
        return (
          <article
            key={s.name}
            className="flex flex-col rounded-lg border border-line bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{s.name}</h3>
                <p className="text-[11px] text-ink-muted">{s.issuer}</p>
              </div>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                  STATUS_STYLE[s.status] ?? "bg-ice text-ink-secondary"
                }`}
              >
                {s.status}
              </span>
            </div>

            <dl className="mt-3 space-y-1 text-[12px]">
              {(
                [
                  ["País", s.country],
                  ["Activo", s.asset],
                  ["Blockchain", s.blockchain],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-20 shrink-0 text-ink-muted">{k}</dt>
                  <dd className="min-w-0 text-ink-secondary">{v}</dd>
                </div>
              ))}
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-ink-muted">Tamaño</dt>
                <dd className="min-w-0">
                  {live !== undefined ? (
                    <>
                      <span className="font-semibold tabular-nums text-ink">
                        {formatUsdCompact(live)}
                      </span>
                      <span className="ml-1 text-[10px] text-ink-muted">en vivo · DeFiLlama</span>
                    </>
                  ) : (
                    <span className="text-ink-secondary">{s.sizeNote}</span>
                  )}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-[12px] leading-relaxed text-ink-secondary">{s.model}</p>

            <p className="mt-3 flex-1 border-t border-line/60 pt-2 text-[12px] leading-relaxed text-ink-secondary">
              <span className="font-semibold text-electric">Lectura: </span>
              {s.lesson}
            </p>

            <p className="mt-3 text-[11px]">
              <a
                href={s.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-core underline hover:text-electric"
              >
                {s.sourceName}
              </a>
            </p>
          </article>
        );
      })}
    </div>
  );
}
