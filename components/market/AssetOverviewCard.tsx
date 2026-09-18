"use client";

import { Card } from "@/components/Card";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatUsdCompact, formatPct } from "@/lib/format";
import { useSource } from "@/lib/useSource";
import type { MarketAsset } from "@/lib/sources/coingecko";

function price(value: number): string {
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: value < 1 ? 5 : value < 100 ? 2 : 0,
  })}`;
}

function Change({ value }: { value: number | null }) {
  return (
    <span className={value === null ? "text-ink-muted" : value >= 0 ? "text-up" : "text-down"}>
      {formatPct(value)}
    </span>
  );
}

const COLUMNS: Column<MarketAsset>[] = [
  {
    key: "rank",
    header: "Activo",
    value: (asset) => asset.symbol,
    required: true,
    render: (asset) => (
      <div className="flex items-baseline gap-2">
        <span className="w-5 text-[10px] tabular-nums text-ink-muted">#{asset.rank ?? "—"}</span>
        <span className="font-medium">{asset.symbol}</span>
        <span className="text-[10px] text-ink-muted">{asset.name}</span>
      </div>
    ),
  },
  {
    key: "price",
    header: "Precio",
    value: (asset) => asset.priceUsd,
    numeric: true,
    render: (asset) => price(asset.priceUsd),
  },
  {
    key: "d1",
    header: "24h",
    value: (asset) => asset.change24hPct,
    numeric: true,
    render: (asset) => <Change value={asset.change24hPct} />,
  },
  {
    key: "d7",
    header: "7d",
    value: (asset) => asset.change7dPct,
    numeric: true,
    render: (asset) => <Change value={asset.change7dPct} />,
  },
  {
    key: "d30",
    header: "30d",
    value: (asset) => asset.change30dPct,
    numeric: true,
    render: (asset) => <Change value={asset.change30dPct} />,
  },
  {
    key: "mcap",
    header: "Market cap",
    value: (asset) => asset.marketCapUsd,
    numeric: true,
    render: (asset) => formatUsdCompact(asset.marketCapUsd),
  },
  {
    key: "dom",
    header: "Dominancia",
    value: (asset) => asset.dominancePct,
    numeric: true,
    render: (asset) =>
      asset.dominancePct === null ? "—" : `${asset.dominancePct.toFixed(2)}%`,
  },
  {
    key: "vol",
    header: "Vol. 24h",
    value: (asset) => asset.volume24hUsd,
    numeric: true,
    render: (asset) => formatUsdCompact(asset.volume24hUsd),
  },
  {
    key: "turnover",
    header: "Turnover",
    value: (asset) => asset.turnover24hPct,
    numeric: true,
    render: (asset) =>
      asset.turnover24hPct === null ? "—" : `${asset.turnover24hPct.toFixed(1)}%`,
  },
  {
    key: "ath",
    header: "Desde ATH",
    value: (asset) => asset.athDrawdownPct,
    numeric: true,
    render: (asset) => <Change value={asset.athDrawdownPct} />,
  },
  {
    key: "float",
    header: "Float máx.",
    value: (asset) => asset.floatPct,
    numeric: true,
    render: (asset) => (asset.floatPct === null ? "—" : `${asset.floatPct.toFixed(1)}%`),
  },
];

export function AssetOverviewCard() {
  const result = useSource<MarketAsset[]>("/api/market/assets", "CoinGecko");

  return (
    <Card
      title="Panorama líquido multiactivo"
      subtitle="Precio, momentum, dominancia, liquidez y dilución de los principales criptoactivos"
    >
      {result === null && <div className="h-56 animate-pulse rounded bg-ice/50" />}
      {result?.ok === false && <Unavailable source={result.source} />}
      {result?.ok && (
        <>
          <DataTable
            rows={result.data}
            columns={COLUMNS}
            exportName="panorama-criptoactivos"
            initialSort={{ key: "mcap", dir: "desc" }}
            rowHistory={(asset) => ({ kind: "asset", id: asset.id, label: `${asset.symbol} · ${asset.name}` })}
          />
          <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
            Turnover = volumen 24h / market cap. Float máx. = oferta circulante / oferta máxima;
            “—” indica que el activo no tiene máximo definido.
          </p>
          <SourceBadge source={result.source} fetchedAt={result.fetchedAt} stale={result.stale} />
        </>
      )}
    </Card>
  );
}
