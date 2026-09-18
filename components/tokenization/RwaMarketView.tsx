"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { SourceBadge } from "@/components/SourceBadge";
import { formatPct, formatUsdCompact } from "@/lib/format";
import { CATEGORICAL, CHART_THEME, TOOLTIP_STYLE } from "@/lib/palette";
import type { RwaMarketToken } from "@/lib/sources/coingecko";
import { useRwa } from "./useRwa";

const columns: Column<RwaMarketToken>[] = [
  {
    key: "name",
    header: "Token / producto",
    value: (row) => row.name,
    required: true,
    render: (row) => (
      <>
        <span className="font-medium">{row.symbol}</span>
        <span className="ml-2 text-[10px] text-ink-muted">{row.name}</span>
      </>
    ),
  },
  { key: "kind", header: "Lectura", value: (row) => row.kind },
  {
    key: "marketCap",
    header: "Capitalización",
    numeric: true,
    value: (row) => row.marketCapUsd,
    render: (row) => formatUsdCompact(row.marketCapUsd),
  },
  {
    key: "volume",
    header: "Volumen 24h",
    numeric: true,
    value: (row) => row.volume24hUsd,
    render: (row) => formatUsdCompact(row.volume24hUsd),
  },
  {
    key: "turnover",
    header: "Turnover",
    numeric: true,
    value: (row) => row.turnover24hPct,
    render: (row) =>
      row.turnover24hPct === null ? "—" : `${row.turnover24hPct.toFixed(1)}%`,
  },
  {
    key: "change24h",
    header: "24h",
    numeric: true,
    value: (row) => row.change24hPct,
    render: (row) => (
      <span className={(row.change24hPct ?? 0) >= 0 ? "text-up" : "text-down"}>
        {formatPct(row.change24hPct)}
      </span>
    ),
  },
  {
    key: "change7d",
    header: "7d",
    numeric: true,
    value: (row) => row.change7dPct,
    render: (row) => (
      <span className={(row.change7dPct ?? 0) >= 0 ? "text-up" : "text-down"}>
        {formatPct(row.change7dPct)}
      </span>
    ),
  },
  {
    key: "change30d",
    header: "30d",
    numeric: true,
    value: (row) => row.change30dPct,
    render: (row) => (
      <span className={(row.change30dPct ?? 0) >= 0 ? "text-up" : "text-down"}>
        {formatPct(row.change30dPct)}
      </span>
    ),
  },
  {
    key: "ath",
    header: "Desde ATH",
    numeric: true,
    value: (row) => row.athDrawdownPct,
    render: (row) => (
      <span className="text-ink-secondary">{formatPct(row.athDrawdownPct)}</span>
    ),
  },
  {
    key: "float",
    header: "Float máx.",
    numeric: true,
    value: (row) => row.floatPct,
    render: (row) => (row.floatPct === null ? "—" : `${row.floatPct.toFixed(1)}%`),
  },
];

export function RwaMarketView() {
  const { data } = useRwa();
  if (!data?.marketTokens.ok || data.marketTokens.data.length === 0) return null;

  const source = data.marketTokens;
  const products = source.data.filter((token) => token.kind === "Producto respaldado");
  const infrastructure = source.data.filter((token) => token.kind === "Infraestructura RWA");
  const chartRows = products.slice(0, 10).map((token) => ({
    name: token.symbol,
    marketCapUsd: token.marketCapUsd,
  }));
  const productCap = products.reduce((sum, token) => sum + token.marketCapUsd, 0);
  const liquidVolume = products.reduce((sum, token) => sum + token.volume24hUsd, 0);

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Mercado líquido asociado a RWA</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-secondary">
            CoinGecko agrupa productos respaldados y tokens de infraestructura en una misma categoría.
            El BBIM los separa: la capitalización de LINK, ONDO o XLM no es valor de activos tokenizados.
          </p>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <p className="text-lg font-bold tabular-nums">{formatUsdCompact(productCap)}</p>
            <p className="text-[10px] text-ink-muted">productos respaldados cubiertos</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{formatUsdCompact(liquidVolume)}</p>
            <p className="text-[10px] text-ink-muted">volumen 24h</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[5fr_7fr]">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Productos respaldados · top por capitalización
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_THEME.grid} horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={70}
                  tick={{ fontSize: 10, fill: CHART_THEME.axis }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [formatUsdCompact(Number(value)), "Capitalización"]}
                />
                <Bar dataKey="marketCapUsd" fill={CATEGORICAL[0]} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Screener · {products.length} productos · {infrastructure.length} tokens de infraestructura
          </p>
          <DataTable
            rows={source.data}
            columns={columns}
            exportName="rwa-liquid-market"
            initialSort={{ key: "marketCap", dir: "desc" }}
            rowHistory={(token) => ({ kind: "asset", id: token.id, label: `${token.symbol} · ${token.name}` })}
            maxHeight="max-h-72"
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-warn">
        No sumar esta capitalización al TVL de DeFiLlama: puede haber solapamiento y son perímetros distintos.
      </p>
      <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">
        Turnover = volumen 24h / market cap. Float máx. compara oferta circulante con oferta máxima;
        no equivale a free float regulatorio.
      </p>
      <SourceBadge source={`${source.source} · categoría Real World Assets`} fetchedAt={source.fetchedAt} stale={source.stale} />
    </section>
  );
}
