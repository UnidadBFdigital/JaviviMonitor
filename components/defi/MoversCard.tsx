"use client";

import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { formatUsdCompact, formatPct } from "@/lib/format";
import { useSource } from "@/lib/useSource";
import { useHistory } from "@/components/history/HistoryProvider";
import type { Movers, ProtocolTvl } from "@/lib/sources/defillama";

function MoverList({ title, items, tone }: { title: string; items: ProtocolTvl[]; tone: "up" | "down" }) {
  const history = useHistory();
  return (
    <div>
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-muted">{title}</p>
      <ul className="space-y-1">
        {items.map((p) => (
          <li key={p.slug}>
            <button
              type="button"
              onClick={() => history.open({ kind: "protocol", id: p.slug, label: p.name })}
              title={`Ver histórico del TVL de ${p.name}`}
              className="group flex w-full items-baseline justify-between gap-2 rounded px-1 text-left text-sm transition-colors hover:bg-ice/30"
            >
              <span className="truncate">
                <span className="font-medium group-hover:text-electric">{p.name}</span>
                <span className="ml-1.5 text-[11px] text-ink-muted">
                  {formatUsdCompact(p.tvlUsd)}
                </span>
              </span>
              <span
                className={`tabular-nums ${tone === "up" ? "text-up" : "text-down"}`}
              >
                {formatPct(p.change7dPct)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MoversCard() {
  const result = useSource<Movers>("/api/defi/movers", "DeFiLlama");

  return (
    <Card
      title="Crecimiento y caída (7d)"
      subtitle="Variación de TVL — protocolos con más de $50M bloqueados"
    >
      {result === null && <div className="h-40 animate-pulse rounded bg-ice/40" />}
      {result?.ok === false && <Unavailable source={result.source} />}
      {result?.ok && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoverList title="Mayor crecimiento" items={result.data.gainers} tone="up" />
            <MoverList title="Mayor caída" items={result.data.losers} tone="down" />
          </div>
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </Card>
  );
}
