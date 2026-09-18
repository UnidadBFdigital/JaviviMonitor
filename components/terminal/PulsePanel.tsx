"use client";

import { usePayload } from "@/lib/useSource";

import { Sparkline } from "@/components/charts/Sparkline";
import { formatUsdCompact, formatPct, formatTimestamp } from "@/lib/format";
import type { FearGreed } from "@/lib/sources/feargreed";
import type { GlobalMarket } from "@/lib/sources/coingecko";
import type { Stablecoin, StablecoinTotal } from "@/lib/sources/stablecoins";
import type { DexOverview } from "@/lib/sources/defillama";
import type { SourceResult } from "@/lib/sources/types";

type Pulse = {
  fearGreed: SourceResult<FearGreed>;
  global: SourceResult<GlobalMarket>;
  stables: SourceResult<Stablecoin[]>;
  stableTotal: SourceResult<StablecoinTotal>;
  dex: SourceResult<DexOverview>;
};

function Row({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-line/60 py-2.5 last:border-0">{children}</div>;
}

function fngColor(v: number): string {
  if (v >= 70) return "text-up";
  if (v <= 30) return "text-down";
  return "text-warn";
}

export function PulsePanel() {
  const { data, error } = usePayload<Pulse>("/api/terminal/pulse");

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="mb-1 text-sm font-semibold">Pulso de mercado</h3>
      {error && <p className="py-6 text-sm text-ink-muted">No disponible.</p>}
      {!data && !error && <div className="h-64 animate-pulse rounded bg-ice/50" />}
      {data && (
        <div>
          <Row>
            <p className="text-[10px] uppercase tracking-widest text-ink-muted">Fear & Greed</p>
            {data.fearGreed.ok ? (
              <div className="mt-1 flex items-center justify-between gap-2">
                <div>
                  <span className={`text-xl font-bold tabular-nums ${fngColor(data.fearGreed.data.value)}`}>
                    {data.fearGreed.data.value}
                  </span>
                  <span className="ml-2 text-xs text-ink-secondary">
                    {data.fearGreed.data.classification}
                  </span>
                </div>
                <Sparkline values={data.fearGreed.data.history.map((h) => h.value)} width={80} />
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No disponible</p>
            )}
            {data.fearGreed.ok && (
              <p className="mt-0.5 text-[9px] text-ink-muted">
                Alternative.me · {formatTimestamp(data.fearGreed.fetchedAt)}
              </p>
            )}
          </Row>
          <Row>
            <p className="text-[10px] uppercase tracking-widest text-ink-muted">Dominancia BTC</p>
            {data.global.ok ? (
              <>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-xl font-bold tabular-nums">
                    {data.global.data.btcDominancePct.toFixed(1)}%
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-ice">
                    <div
                      className="h-full rounded bg-warn"
                      style={{ width: `${data.global.data.btcDominancePct}%` }}
                    />
                  </div>
                </div>
                <p className="mt-0.5 text-[9px] text-ink-muted">
                  ETH {data.global.data.ethDominancePct.toFixed(1)}% · CoinGecko ·{" "}
                  {formatTimestamp(data.global.fetchedAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">No disponible</p>
            )}
          </Row>
          <Row>
            <p className="text-[10px] uppercase tracking-widest text-ink-muted">
              Market cap stablecoins
            </p>
            {data.stableTotal.ok ? (
              <>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-xl font-bold tabular-nums">
                    {formatUsdCompact(data.stableTotal.data.totalUsd)}
                  </span>
                  <span
                    className={`text-[11px] ${
                      (data.stableTotal.data.change7dPct ?? 0) >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {formatPct(data.stableTotal.data.change7dPct)} 7d
                  </span>
                </div>
                {data.stables.ok && (
                  <p className="mt-1 text-[9px] text-ink-secondary">
                    {data.stables.data
                      .slice(0, 3)
                      .map((stablecoin) =>
                        `${stablecoin.symbol} ${formatUsdCompact(stablecoin.circulatingUsd)}`
                      )
                      .join(" · ")}
                  </p>
                )}
                <p className="mt-0.5 text-[9px] text-ink-muted">
                  DeFiLlama dashboard · {formatTimestamp(data.stableTotal.fetchedAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">No disponible</p>
            )}
          </Row>
          <Row>
            <p className="text-[10px] uppercase tracking-widest text-ink-muted">Volumen DEX 24h</p>
            {data.dex.ok ? (
              <>
                <p className="mt-1 text-xl font-bold tabular-nums">
                  {formatUsdCompact(data.dex.data.total24hUsd)}
                  {data.dex.data.change7dPct !== null && (
                    <span
                      className={`ml-2 text-xs font-normal ${
                        data.dex.data.change7dPct >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {formatPct(data.dex.data.change7dPct)} 7d/7d
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[9px] text-ink-muted">
                  DeFiLlama · {formatTimestamp(data.dex.fetchedAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">No disponible</p>
            )}
          </Row>
        </div>
      )}
    </section>
  );
}
