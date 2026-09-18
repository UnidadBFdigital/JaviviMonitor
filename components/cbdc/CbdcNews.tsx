"use client";

import { usePayload } from "@/lib/useSource";
import { NewsList } from "@/components/news/NewsList";
import type { Headline } from "@/lib/sources/news";
import type { SourceResult } from "@/lib/sources/types";

type Payload = {
  cbdc: SourceResult<Headline[]>;
  regulacion: SourceResult<Headline[]>;
};

export function CbdcNews() {
  const { data, error } = usePayload<Payload>("/api/cbdc");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">CBDC en las noticias</h3>
        <p className="mb-2 text-xs text-ink-secondary">
          Titulares clasificados como CBDC — a diferencia del tracker, esto sí es live.
        </p>
        {error && <p className="py-6 text-sm text-ink-muted">No disponible.</p>}
        {!data && !error && <div className="h-64 animate-pulse rounded bg-ice/50" />}
        {data && (
          <NewsList
            result={data.cbdc}
            emptyLabel="Sin titulares de CBDC en la ventana de noticias actual."
          />
        )}
      </section>

      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Radar regulatorio</h3>
        <p className="mb-2 text-xs text-ink-secondary">
          Movimientos de reguladores y legisladores: SEC, CFTC, FATF, MiCA, licencias y litigios.
        </p>
        {error && <p className="py-6 text-sm text-ink-muted">No disponible.</p>}
        {!data && !error && <div className="h-64 animate-pulse rounded bg-ice/50" />}
        {data && (
          <NewsList
            result={data.regulacion}
            emptyLabel="Sin titulares regulatorios en la ventana actual."
          />
        )}
      </section>
    </div>
  );
}
