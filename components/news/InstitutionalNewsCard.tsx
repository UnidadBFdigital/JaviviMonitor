"use client";

import { formatTimestamp } from "@/lib/format";
import { NewsItem } from "./NewsList";
import { usePayload } from "@/lib/useSource";
import type { Headline } from "@/lib/sources/news";
import type { SourceResult } from "@/lib/sources/types";

type Payload = {
  institutional: SourceResult<Headline[]>;
  regulatory: SourceResult<Headline[]>;
};

export function InstitutionalNewsCard({ limit = 8 }: { limit?: number }) {
  const { data, error } = usePayload<Payload>("/api/news/institutional");

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Noticias institucionales</h3>
      <p className="mb-2 text-xs text-ink-secondary">
        Priorizadas por relevancia B2B (banca, stablecoins, RWA, regulación) — sin ruido retail
      </p>
      {error && <p className="py-6 text-sm text-ink-muted">No disponible.</p>}
      {!data && !error && <div className="h-64 animate-pulse rounded bg-ice/50" />}
      {data?.institutional.ok && (
        <>
          <ul>
            {data.institutional.data.slice(0, limit).map((h) => (
              <NewsItem key={h.url} h={h} />
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-ink-muted">
            Fuentes: The Block · Blockworks · CoinDesk · Cointelegraph · Decrypt — consultado{" "}
            {formatTimestamp(data.institutional.fetchedAt)}
          </p>
        </>
      )}
      {data?.institutional.ok === false && (
        <p className="py-6 text-sm text-ink-muted">Dato no disponible.</p>
      )}
    </section>
  );
}

export function RegulatoryNewsCard() {
  const { data, error } = usePayload<Payload>("/api/news/institutional");

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">Eventos regulatorios</h3>
      {error && <p className="py-6 text-sm text-ink-muted">No disponible.</p>}
      {!data && !error && <div className="h-64 animate-pulse rounded bg-ice/50" />}
      {data?.regulatory.ok && (
        <ul>
          {data.regulatory.data.map((h) => (
            <NewsItem key={h.url} h={h} />
          ))}
        </ul>
      )}
      {data?.regulatory.ok === false && (
        <p className="py-6 text-sm text-ink-muted">Dato no disponible.</p>
      )}
    </section>
  );
}
