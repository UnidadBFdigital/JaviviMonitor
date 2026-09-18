"use client";

import { formatTimestamp } from "@/lib/format";
import type { Headline } from "@/lib/sources/news";
import type { SourceResult } from "@/lib/sources/types";

export function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export function NewsItem({ h }: { h: Headline }) {
  return (
    <li className="border-b border-line/60 py-2 last:border-0">
      <a
        href={h.url}
        target="_blank"
        rel="noreferrer"
        className="text-[13px] leading-snug hover:text-electric"
      >
        {h.title}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="font-semibold text-ink-secondary">{h.outlet}</span>
        <span className="text-ink-muted">{relativeTime(h.publishedAt)}</span>
        {h.categories.map((c) => (
          <span key={c} className="rounded bg-electric/15 px-1.5 py-0.5 text-electric">
            {c}
          </span>
        ))}
        {h.entities.slice(0, 3).map((e) => (
          <span key={e} className="rounded bg-ice px-1.5 py-0.5 text-ink-secondary">
            {e}
          </span>
        ))}
      </div>
    </li>
  );
}

/** Lista de titulares con sus estados de error/vacío ya resueltos. */
export function NewsList({
  result,
  limit,
  emptyLabel = "Sin titulares.",
  showSource = true,
}: {
  result: SourceResult<Headline[]>;
  limit?: number;
  emptyLabel?: string;
  showSource?: boolean;
}) {
  if (!result.ok) return <p className="py-6 text-sm text-ink-muted">Dato no disponible.</p>;
  if (result.data.length === 0)
    return <p className="py-6 text-sm text-ink-muted">{emptyLabel}</p>;

  return (
    <>
      <ul>
        {(limit ? result.data.slice(0, limit) : result.data).map((h) => (
          <NewsItem key={h.url} h={h} />
        ))}
      </ul>
      {showSource && (
        <p className="mt-2 text-[10px] text-ink-muted">
          Fuentes: The Block · Blockworks · CoinDesk · Cointelegraph · Decrypt — consultado{" "}
          {formatTimestamp(result.fetchedAt)}
        </p>
      )}
    </>
  );
}
