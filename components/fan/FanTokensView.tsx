"use client";

import { usePayload } from "@/lib/useSource";
import { DonutChart } from "@/components/charts/DonutChart";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { formatUsdCompact, formatPct } from "@/lib/format";
import { UNCLASSIFIED, type League } from "@/lib/fanTokens";
import type { FanToken } from "@/lib/sources/coingecko";

type Payload = {
  source: { ok: true; source: string; fetchedAt: string; stale?: boolean } | { ok: false };
  totalMarketCapUsd: number;
  totalVolume24hUsd: number;
  leagues: League[];
  tokens: FanToken[];
  insights: string[];
};

function Change({ value }: { value: number | null }) {
  return (
    <span className={value === null ? "text-ink-muted" : value >= 0 ? "text-up" : "text-down"}>
      {formatPct(value)}
    </span>
  );
}

const columns: Column<FanToken>[] = [
  { key: "symbol", header: "Token", value: (r) => r.symbol, required: true },
  { key: "name", header: "Club / entidad", value: (r) => r.name },
  {
    key: "cap",
    header: "Market cap",
    numeric: true,
    value: (r) => r.marketCapUsd,
    render: (r) => formatUsdCompact(r.marketCapUsd),
  },
  {
    key: "vol",
    header: "Volumen 24h",
    numeric: true,
    value: (r) => r.volume24hUsd,
    render: (r) => formatUsdCompact(r.volume24hUsd),
  },
  {
    key: "ch24",
    header: "24h",
    numeric: true,
    value: (r) => r.change24hPct,
    render: (r) => <Change value={r.change24hPct} />,
  },
  {
    key: "ch7",
    header: "7d",
    numeric: true,
    value: (r) => r.change7dPct,
    render: (r) => <Change value={r.change7dPct} />,
  },
];

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex-1 rounded-lg border border-line bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] text-ink-secondary">{note}</p>
    </div>
  );
}

export function FanTokensView() {
  const { data, error } = usePayload<Payload>("/api/fan-tokens");

  if (error) return <Unavailable source="CoinGecko" />;
  if (!data)
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-lg bg-ice/50" />
        <div className="h-96 animate-pulse rounded-lg bg-ice/50" />
      </div>
    );
  if (!data.source.ok) return <Unavailable source="CoinGecko" />;

  const rotacion =
    data.totalMarketCapUsd > 0 ? (data.totalVolume24hUsd / data.totalMarketCapUsd) * 100 : null;
  const competencias = data.leagues.filter((l) => l.name !== UNCLASSIFIED).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Kpi
          label="Market cap total"
          value={formatUsdCompact(data.totalMarketCapUsd)}
          note={`${data.tokens.length} tokens · ${competencias} competencias`}
        />
        <Kpi
          label="Volumen 24h"
          value={formatUsdCompact(data.totalVolume24hUsd)}
          note={rotacion !== null ? `rotación ${rotacion.toFixed(1)}% del market cap` : "—"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[5fr_7fr]">
        <section className="rounded-lg border border-line bg-card p-4">
          <h3 className="text-sm font-semibold">Market cap por competencia</h3>
          <p className="text-xs text-ink-secondary">
            Clasificación propia de Blockfinity sobre la categoría fan-token de CoinGecko.
          </p>

          <div className="mt-3 h-52">
            <DonutChart
              items={data.leagues.map((l) => ({ name: l.name, value: l.marketCapUsd }))}
              formatValue={formatUsdCompact}
              centerLabel="Fan tokens"
              maxSlices={8}
            />
          </div>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-ink-muted">
                <th className="border-b border-line pb-1.5 pr-2 text-left font-medium">
                  Competencia
                </th>
                <th className="border-b border-line px-2 pb-1.5 text-right font-medium">Cap</th>
                <th className="border-b border-line px-2 pb-1.5 text-right font-medium">Peso</th>
                <th className="border-b border-line pb-1.5 pl-2 text-right font-medium">7d</th>
              </tr>
            </thead>
            <tbody>
              {data.leagues.map((l) => (
                <tr key={l.name} className="border-b border-line/50 last:border-0">
                  <td className="py-1.5 pr-2">
                    <span className={l.name === UNCLASSIFIED ? "text-ink-muted" : ""}>{l.name}</span>
                    <span className="block text-[10px] text-ink-muted">
                      {l.tokens} token{l.tokens === 1 ? "" : "s"}
                      {l.name !== UNCLASSIFIED && l.top.length > 0 && ` · ${l.top.join(" · ")}`}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatUsdCompact(l.marketCapUsd)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink-secondary">
                    {l.sharePct.toFixed(1)}%
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    <Change value={l.change7dPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.insights.length > 0 && (
            <div className="mt-4 border-t border-line/60 pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-electric">
                Lecturas del mercado
              </p>
              <ol className="space-y-1.5">
                {data.insights.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-px w-3 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink-muted">
                      {i + 1}
                    </span>
                    <span className="text-[12px] leading-relaxed text-ink-secondary">{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <SourceBadge
            source={`${data.source.source} — clasificación por competencia propia`}
            fetchedAt={data.source.fetchedAt}
            stale={data.source.stale}
          />
        </section>

        <section className="rounded-lg border border-line bg-card p-4">
          <h3 className="text-sm font-semibold">Tokens por club y entidad</h3>
          <p className="mb-3 text-xs text-ink-secondary">
            Los 50 mayores por capitalización. Ordenable y exportable a CSV.
          </p>
          <DataTable
            rows={data.tokens}
            columns={columns}
            exportName="fan-tokens"
            initialSort={{ key: "cap", dir: "desc" }}
            rowHistory={(token) => ({ kind: "asset", id: token.id, label: `${token.symbol} · ${token.name}` })}
            maxHeight="max-h-[36rem]"
          />
          <SourceBadge
            source={data.source.source}
            fetchedAt={data.source.fetchedAt}
            stale={data.source.stale}
          />
        </section>
      </div>
    </div>
  );
}
