"use client";

import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { useSource } from "@/lib/useSource";
import type { Headline } from "@/lib/sources/news";

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export function NewsCard() {
  const result = useSource<Headline[]>("/api/news/headlines", "RSS");

  return (
    <Card title="Titulares" subtitle="Últimas noticias cripto — fuentes en inglés">
      {result === null && <div className="h-40 animate-pulse rounded bg-ice/40" />}
      {result?.ok === false && <Unavailable source={result.source} />}
      {result?.ok && (
        <>
          <ul className="space-y-2">
            {result.data.map((h) => (
              <li key={h.url} className="border-b border-line/60 pb-2 last:border-0">
                <a
                  href={h.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm leading-snug hover:text-electric"
                >
                  {h.title}
                </a>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {h.outlet} · {relativeTime(h.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </Card>
  );
}
