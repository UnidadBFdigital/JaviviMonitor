"use client";

import { formatTimestamp } from "@/lib/format";
import type { BoliviaHeadline } from "@/lib/sources/bolivianews";
import type { SourceResult } from "@/lib/sources/types";
import { useSource } from "@/lib/useSource";

export default function BoliviaNoticiasPage() {
  const result: SourceResult<BoliviaHeadline[]> | null = useSource(
    "/api/bolivia/news",
    "Google News"
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Noticias Bolivia</h2>
        <p className="text-xs text-ink-muted">
          Prensa sobre cripto, dólar y regulación financiera boliviana (BCB, ASFI, tipo de cambio)
        </p>
      </div>
      <section className="rounded-lg border border-line bg-card p-4">
        {result === null && <div className="h-96 animate-pulse rounded bg-ice/50" />}
        {result?.ok === false && (
          <p className="py-8 text-center text-sm text-ink-muted">Dato no disponible.</p>
        )}
        {result?.ok && (
          <>
            <ul>
              {result.data.map((h) => (
                <li key={h.url} className="border-b border-line/60 py-2.5 last:border-0">
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm leading-snug hover:text-electric"
                  >
                    {h.title}
                  </a>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {h.outlet} · {new Date(h.publishedAt).toLocaleDateString("es-BO")}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-ink-muted">
              Fuente: {result.source} · consultado {formatTimestamp(result.fetchedAt)}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
