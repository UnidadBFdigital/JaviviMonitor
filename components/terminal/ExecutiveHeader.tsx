"use client";

import { usePayload } from "@/lib/useSource";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatUsdCompact, formatPct, formatTimestamp } from "@/lib/format";
import type { Ticker } from "@/lib/sources/cryptocom";
import type { GlobalMarket } from "@/lib/sources/coingecko";
import type { StablecoinTotal } from "@/lib/sources/stablecoins";
import type { SourceResult } from "@/lib/sources/types";
import type { RwaDashboardMetrics } from "@/lib/sources/defillamaRwa";

// Portada del Research Terminal: titular + cuatro cifras que un ejecutivo
// debería poder leer en 30 segundos. Los cuatro ejes del hub: mercado,
// stablecoins, tokenización e infraestructura.

type Overview = {
  tickers: SourceResult<Ticker[]>;
  global: SourceResult<GlobalMarket>;
  tvl: SourceResult<{ currentUsd: number; spark: number[] }>;
  sparklines: Record<string, number[]>;
};

type Pulse = {
  stableTotal: SourceResult<StablecoinTotal>;
};

type Rwa = {
  source: { ok: true; source: string; fetchedAt: string } | { ok: false };
  dashboard: SourceResult<RwaDashboardMetrics>;
  totalUsd: number;
  sectors: { name: string; tvlUsd: number; change7dPct: number | null }[];
};

type Insights = {
  ok: boolean;
  hallazgos: string[];
  riesgos: string[];
  oportunidades: string[];
  fetchedAt: string;
};

/** Variación 7d del RWA total, ponderando la de cada sector por su tamaño. */
function rwaChange7d(sectors: Rwa["sectors"]): number | null {
  let now = 0;
  let prev = 0;
  for (const s of sectors) {
    now += s.tvlUsd;
    prev += s.change7dPct !== null && s.change7dPct > -100 ? s.tvlUsd / (1 + s.change7dPct / 100) : s.tvlUsd;
  }
  return prev > 0 ? ((now - prev) / prev) * 100 : null;
}

function Kpi({
  label,
  value,
  changePct,
  changeLabel,
  note,
  spark,
  source,
  index = 0,
}: {
  label: string;
  value: string;
  changePct?: number | null;
  changeLabel?: string;
  note?: string;
  spark?: number[];
  source: string;
  index?: number;
}) {
  const positive = changePct !== undefined && changePct !== null ? changePct >= 0 : undefined;
  return (
    <div
      className="bf-frame bf-reveal group"
      style={{ "--bf-cut": "14px", "--bf-i": index } as React.CSSProperties}
    >
      <div className="relative overflow-hidden bg-card px-4 py-3">
        {/* filete superior: pasa de acento a transparente en el hover */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70 transition-opacity group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(to right, var(--color-gold), transparent 65%)",
          }}
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          {label}
        </p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="text-[28px] font-bold tabular-nums leading-none tracking-tight">{value}</p>
          {spark && spark.length > 1 && (
            <Sparkline values={spark} positive={positive} width={76} height={30} />
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          {changePct !== undefined && (
            <span
              className={`text-xs font-medium tabular-nums ${
                changePct === null ? "text-ink-muted" : changePct >= 0 ? "text-up" : "text-down"
              }`}
            >
              {changePct !== null && (changePct >= 0 ? "▲" : "▼")} {formatPct(changePct)}
              {changeLabel ? ` ${changeLabel}` : ""}
            </span>
          )}
          {note && <span className="truncate text-[11px] text-ink-secondary">{note}</span>}
        </div>
        <p className="mt-1.5 text-[9px] uppercase tracking-wider text-ink-muted">{source}</p>
      </div>
    </div>
  );
}

/** Fecha larga del brief. Se deriva del timestamp del servidor para que no
 *  haya desajuste de hidratación entre render y cliente. */
function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-BO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function KpiSkeleton() {
  return <div className="bf-shimmer h-[116px] rounded-lg" />;
}

export function ExecutiveHeader() {
  const overview = usePayload<Overview>("/api/terminal/overview");
  const pulse = usePayload<Pulse>("/api/terminal/pulse");
  const rwa = usePayload<Rwa>("/api/tokenization/rwa");
  const insights = usePayload<Insights>("/api/insights");

  const ticker = (inst: string) =>
    overview.data?.tickers.ok
      ? overview.data.tickers.data.find((t) => t.instrument === inst)
      : undefined;
  const btc = ticker("BTC_USDT");
  const eth = ticker("ETH_USDT");

  const stables = pulse.data?.stableTotal.ok ? pulse.data.stableTotal.data : null;

  const rwaMarket = rwa.data?.dashboard.ok ? rwa.data.dashboard.data : null;
  const rwaProtocols = rwa.data?.source.ok && rwa.data.totalUsd > 0 ? rwa.data : null;
  const rwaProtocolChange = rwaProtocols ? rwaChange7d(rwaProtocols.sectors) : null;

  const tvl = overview.data?.tvl.ok ? overview.data.tvl.data : null;

  const ins = insights.data;
  const señales = ins?.ok
    ? ins.hallazgos.length + ins.riesgos.length + ins.oportunidades.length
    : null;

  // Bajada: tres cifras del día, no una frase inventada.
  const bajada: string[] = [];
  if (overview.data?.global.ok) {
    const g = overview.data.global.data;
    bajada.push(
      `Market cap ${formatUsdCompact(g.totalMarketCapUsd)} (${formatPct(g.marketCapChange24hPct)} 24h)`
    );
  }
  if (stables && stables.change7dPct !== null) {
    bajada.push(`Market cap stablecoins ${formatPct(stables.change7dPct)} 7d`);
  }
  if (rwaMarket) bajada.push(`RWA on-chain ${formatUsdCompact(rwaMarket.onchainMcapUsd)}`);
  if (tvl) bajada.push(`TVL DeFi ${formatUsdCompact(tvl.currentUsd)}`);

  return (
    <section className="space-y-4">
      {/* Titular sobre retícula: separa el brief del resto sin otra ficha */}
      <div className="bf-reveal relative overflow-hidden rounded-lg px-4 py-4 sm:px-5">
        <div className="bf-grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 140% at 0% 0%, rgba(201,162,39,0.09), transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-electric">
          Executive Brief
          {ins?.fetchedAt && (
            <>
              <span className="mx-1.5 text-ink-muted">·</span>
              <span className="font-normal text-ink-secondary">{fecha(ins.fetchedAt)}</span>
              <span className="ml-2 font-normal text-ink-muted">
                actualizado {formatTimestamp(ins.fetchedAt)}
              </span>
            </>
          )}
        </p>
        <h1 className="mt-1.5 text-2xl font-bold leading-[1.15] tracking-tight lg:text-[34px]">
          {señales === null
            ? "Lectura del ecosistema en 30 segundos"
            : `${señales} ${señales === 1 ? "señal" : "señales"} del ecosistema para hoy`}
        </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            {bajada.length > 0 ? bajada.join(" · ") : "Cargando cifras del día…"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!overview.data && !overview.error ? (
          <KpiSkeleton />
        ) : btc ? (
          <Kpi
            label="BTC"
            index={0}
            value={`$${btc.lastPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            changePct={btc.change24hPct}
            changeLabel="24h"
            spark={overview.data?.sparklines["BTC_USDT"]}
            source="Crypto.com"
          />
        ) : (
          <Kpi label="BTC" value="—" source="Crypto.com — sin respuesta" />
        )}

        {!overview.data && !overview.error ? (
          <KpiSkeleton />
        ) : eth ? (
          <Kpi
            label="ETH"
            index={1}
            value={`$${eth.lastPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            changePct={eth.change24hPct}
            changeLabel="24h"
            spark={overview.data?.sparklines["ETH_USDT"]}
            source="Crypto.com"
          />
        ) : (
          <Kpi label="ETH" value="—" source="Crypto.com — sin respuesta" />
        )}

        {!pulse.data && !pulse.error ? (
          <KpiSkeleton />
        ) : stables ? (
          <Kpi
            label="Market cap stablecoins"
            index={2}
            value={formatUsdCompact(stables.totalUsd)}
            changePct={stables.change7dPct}
            changeLabel="7d"
            note="total oficial · sin doble conteo"
            source="DeFiLlama Stablecoins Dashboard"
          />
        ) : (
          <Kpi label="Market cap stablecoins" value="—" source="DeFiLlama — sin respuesta" />
        )}

        {!rwa.data && !rwa.error ? (
          <KpiSkeleton />
        ) : rwaMarket ? (
          <Kpi
            label="RWA Onchain AUM"
            index={3}
            value={formatUsdCompact(rwaMarket.onchainMcapUsd)}
            note={[
              rwaMarket.issuerCount !== null ? `${rwaMarket.issuerCount} emisores` : null,
              rwaProtocolChange === null ? null : `TVL protocolos ${formatPct(rwaProtocolChange)} 7d`,
            ]
              .filter(Boolean)
              .join(" · ")}
            source="DeFiLlama RWA Dashboard · sin stablecoins"
          />
        ) : (
          <Kpi label="RWA Onchain AUM" value="—" source="DeFiLlama — sin respuesta" />
        )}
      </div>
    </section>
  );
}
