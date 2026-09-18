"use client";

import { Sparkline } from "@/components/charts/Sparkline";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { formatUsdCompact, formatPct } from "@/lib/format";
import type { Quote } from "@/lib/sources/yahoo";
import type { SourceResult } from "@/lib/sources/types";
import { useHistory } from "@/components/history/HistoryProvider";

export function Change({ value }: { value: number | null }) {
  return (
    <span
      className={
        value === null ? "text-ink-muted" : value >= 0 ? "text-up" : "text-down"
      }
    >
      {formatPct(value)}
    </span>
  );
}

export function QuotesCard({
  title,
  subtitle,
  result,
  loading,
}: {
  title: string;
  subtitle: string;
  result: SourceResult<Quote[]> | undefined;
  loading: boolean;
}) {
  const history = useHistory();
  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mb-3 text-xs text-ink-secondary">{subtitle}</p>

      {loading && <div className="h-64 animate-pulse rounded bg-ice/50" />}
      {!loading && (!result || !result.ok) && <Unavailable source="Yahoo Finance" />}

      {result?.ok && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-ink-muted">
                  <th className="border-b border-line pb-1.5 pr-2 text-left font-medium">Símbolo</th>
                  <th className="border-b border-line px-2 pb-1.5 text-right font-medium">Precio</th>
                  <th className="border-b border-line px-2 pb-1.5 text-right font-medium">1d</th>
                  <th className="border-b border-line px-2 pb-1.5 text-right font-medium">7d</th>
                  <th className="border-b border-line px-2 pb-1.5 text-right font-medium">30d</th>
                  <th className="border-b border-line px-2 pb-1.5 text-right font-medium">
                    Negociado
                  </th>
                  <th className="border-b border-line pb-1.5 pl-2 text-right font-medium">90d</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((q) => (
                  <tr
                    key={q.symbol}
                    onClick={() => history.open({ kind: "quote", id: q.symbol, label: `${q.symbol} · ${q.name}` })}
                    className="group cursor-pointer border-b border-line/50 last:border-0 hover:bg-ice/30"
                  >
                    <td className="py-1.5 pr-2">
                      <span className="font-medium">{q.symbol}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          history.open({ kind: "quote", id: q.symbol, label: `${q.symbol} · ${q.name}` });
                        }}
                        aria-label={`Ver histórico de ${q.symbol}`}
                        className="ml-1.5 text-[10px] text-core opacity-0 transition-opacity hover:text-electric focus:opacity-100 group-hover:opacity-100"
                      >
                        ↗
                      </button>
                      <span className="block max-w-[15rem] truncate text-[10px] text-ink-muted">
                        {q.name}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      ${q.price.toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      <Change value={q.change1dPct} />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      <Change value={q.change7dPct} />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      <Change value={q.change30dPct} />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-ink-secondary">
                      {q.turnoverUsd !== null ? formatUsdCompact(q.turnoverUsd) : "—"}
                    </td>
                    <td className="py-1.5 pl-2 text-right">
                      <Sparkline
                        values={q.spark}
                        positive={(q.change30dPct ?? 0) >= 0}
                        width={64}
                        height={22}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </section>
  );
}
