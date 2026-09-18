"use client";

import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatUsdCompact, formatPct } from "@/lib/format";
import { useSource } from "@/lib/useSource";
import type { Ticker } from "@/lib/sources/cryptocom";

const COLUMNS: Column<Ticker>[] = [
  {
    key: "pair",
    header: "Par",
    value: (t) => t.instrument.replace("_", "/"),
    required: true,
    render: (t) => <span className="font-medium">{t.instrument.replace("_", "/")}</span>,
  },
  {
    key: "last",
    header: "Último",
    value: (t) => t.lastPrice,
    numeric: true,
    render: (t) => `$${t.lastPrice.toLocaleString("en-US")}`,
  },
  {
    key: "d1",
    header: "24h",
    value: (t) => t.change24hPct,
    numeric: true,
    render: (t) => (
      <span
        className={
          (t.change24hPct ?? 0) > 0
            ? "text-up"
            : (t.change24hPct ?? 0) < 0
              ? "text-down"
              : "text-ink-muted"
        }
      >
        {formatPct(t.change24hPct)}
      </span>
    ),
  },
  {
    key: "high",
    header: "Máx 24h",
    value: (t) => t.high24h,
    numeric: true,
    render: (t) => `$${t.high24h.toLocaleString("en-US")}`,
  },
  {
    key: "low",
    header: "Mín 24h",
    value: (t) => t.low24h,
    numeric: true,
    render: (t) => `$${t.low24h.toLocaleString("en-US")}`,
  },
  {
    key: "vol",
    header: "Vol. 24h",
    value: (t) => t.volume24hUsd,
    numeric: true,
    render: (t) => formatUsdCompact(t.volume24hUsd),
  },
];

export function MarketTickersCard() {
  const result = useSource<Ticker[]>("/api/market/tickers", "Crypto.com Exchange");

  return (
    <Card title="Precios spot" subtitle="Pares USDT — último precio y rango 24h">
      {result === null && <div className="h-56 animate-pulse rounded bg-ice/50" />}
      {result?.ok === false && <Unavailable source={result.source} />}
      {result?.ok && (
        <>
          <DataTable
            rows={result.data}
            columns={COLUMNS}
            exportName="precios-spot"
            initialSort={{ key: "vol", dir: "desc" }}
            rowHistory={(t) => ({ kind: "ticker", id: t.instrument, label: t.instrument.replace("_", "/") })}
          />
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </Card>
  );
}
