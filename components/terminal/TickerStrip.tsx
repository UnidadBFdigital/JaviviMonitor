"use client";

import { usePayload } from "@/lib/useSource";

import { Sparkline } from "@/components/charts/Sparkline";
import { formatUsdCompact, formatPct, formatTimestamp } from "@/lib/format";
import type { Ticker } from "@/lib/sources/cryptocom";
import type { GlobalMarket } from "@/lib/sources/coingecko";
import type { SourceResult } from "@/lib/sources/types";

type Overview = {
  tickers: SourceResult<Ticker[]>;
  bnb: {
    ok: boolean;
    price?: number;
    change24hPct?: number | null;
    spark?: number[];
    fetchedAt?: string;
  };
  global: SourceResult<GlobalMarket>;
  tvl: SourceResult<{ currentUsd: number; spark: number[] }>;
  sparklines: Record<string, number[]>;
};

function KpiCard({
  label,
  value,
  changePct,
  spark,
  source,
  fetchedAt,
}: {
  label: string;
  value: string;
  changePct?: number | null;
  spark?: number[];
  source: string;
  fetchedAt?: string;
}) {
  const positive = changePct !== undefined && changePct !== null ? changePct >= 0 : undefined;
  return (
    <div className="min-w-[150px] flex-1 rounded-lg border border-line bg-card px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div>
          <p className="text-base font-semibold tabular-nums leading-tight transition-all">{value}</p>
          {changePct !== undefined && (
            <p
              className={`text-[11px] tabular-nums ${
                changePct === null
                  ? "text-ink-muted"
                  : changePct >= 0
                    ? "text-up"
                    : "text-down"
              }`}
            >
              {formatPct(changePct)} 24h
            </p>
          )}
        </div>
        {spark && spark.length > 1 && <Sparkline values={spark} positive={positive} width={72} height={26} />}
      </div>
      <p className="mt-1 truncate text-[9px] text-ink-muted" title={fetchedAt}>
        {source}
        {fetchedAt ? ` · ${formatTimestamp(fetchedAt)}` : ""}
      </p>
    </div>
  );
}

export function TickerStrip() {
  const { data, error } = usePayload<Overview>("/api/terminal/overview");

  if (error)
    return <p className="text-sm text-ink-muted">Top bar no disponible (error de red).</p>;
  if (!data)
    return (
      <div className="flex gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-20 flex-1 animate-pulse rounded-lg bg-ice/50" />
        ))}
      </div>
    );

  const t = data.tickers;
  const cards: React.ReactNode[] = [];

  if (t.ok) {
    for (const ticker of t.data) {
      const sym = ticker.instrument.split("_")[0];
      cards.push(
        <KpiCard
          key={sym}
          label={sym}
          value={`$${ticker.lastPrice.toLocaleString("en-US", { maximumFractionDigits: ticker.lastPrice < 10 ? 4 : 0 })}`}
          changePct={ticker.change24hPct}
          spark={data.sparklines[ticker.instrument]}
          source="Crypto.com"
          fetchedAt={t.fetchedAt}
        />
      );
    }
  }
  if (data.bnb.ok && data.bnb.price !== undefined) {
    cards.push(
      <KpiCard
        key="BNB"
        label="BNB"
        value={`$${data.bnb.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
        changePct={data.bnb.change24hPct}
        spark={data.bnb.spark}
        source="Yahoo Finance"
        fetchedAt={data.bnb.fetchedAt}
      />
    );
  }
  if (data.global.ok) {
    cards.push(
      <KpiCard
        key="mcap"
        label="Market cap total"
        value={formatUsdCompact(data.global.data.totalMarketCapUsd)}
        changePct={data.global.data.marketCapChange24hPct}
        source="CoinGecko"
        fetchedAt={data.global.fetchedAt}
      />
    );
  }
  if (data.tvl.ok) {
    cards.push(
      <KpiCard
        key="tvl"
        label="TVL DeFi total"
        value={formatUsdCompact(data.tvl.data.currentUsd)}
        spark={data.tvl.data.spark}
        source="DeFiLlama"
        fetchedAt={data.tvl.fetchedAt}
      />
    );
  }

  if (cards.length === 0)
    return <p className="text-sm text-ink-muted">Dato no disponible (todas las fuentes fallaron).</p>;

  return <div className="flex flex-wrap gap-2">{cards}</div>;
}
