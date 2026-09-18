"use client";

import Link from "next/link";
import { DonutChart } from "@/components/charts/DonutChart";
import { SECTOR_CLASS } from "@/lib/rwaClasses";
import { SourceBadge } from "@/components/SourceBadge";
import { formatUsdCompact, formatPct } from "@/lib/format";
import { UNCLASSIFIED } from "@/lib/rwaSectors";
import { useRwa } from "./useRwa";

export function TokenizationBrief() {
  const { data, error } = useRwa();

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 className="flex items-baseline gap-2 text-sm font-semibold"><span className="bf-slash bf-slash-gold" aria-hidden />Tokenización · mercado RWA</h2>
        <p className="text-[10px] text-ink-muted">
          AUM oficial y TVL de protocolos, presentados por separado.
        </p>
      </div>
      <Link href="/tokenizacion" className="text-[11px] text-core underline hover:text-electric">
        Tokenization Hub →
      </Link>
    </div>
  );

  if (error) {
    return (
      <section className="bf-frame bf-reveal"><div className="bg-card p-4">
        {header}
        <p className="py-6 text-sm text-ink-muted">No disponible (error de red).</p>
      </div></section>
    );
  }

  if (!data) {
    return (
      <section className="bf-frame bf-reveal"><div className="bg-card p-4">
        {header}
        <div className="bf-shimmer mt-3 h-56 rounded" />
      </div></section>
    );
  }

  const official = data.dashboard.ok ? data.dashboard.data : null;
  const hasProtocols = data.source.ok && data.sectors.length > 0;

  if (!official && !hasProtocols) {
    return (
      <section className="bf-frame bf-reveal"><div className="bg-card p-4">
        {header}
        <p className="py-6 text-sm text-ink-muted">
          Datos no disponibles — DeFiLlama sin respuesta.
        </p>
      </div></section>
    );
  }

  const clasificados = hasProtocols
    ? data.sectors.filter((sector) => sector.name !== UNCLASSIFIED)
    : [];
  const visibles = clasificados.slice(0, 4);
  // Active AUM de la clase equivalente: el TVL de un sector no es el tamaño de su mercado
  const classByName = new Map((official?.classes ?? []).map((c) => [c.name, c]));
  const marketOf = (name: string) => {
    const cls = SECTOR_CLASS[name];
    return cls ? (classByName.get(cls) ?? null) : null;
  };

  return (
    <section className="bf-frame bf-reveal"><div className="bg-card p-4">
      {header}

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div>
          {official ? (
            <>
              <p className="text-2xl font-bold tabular-nums leading-none">
                {formatUsdCompact(official.onchainMcapUsd)}
              </p>
              <p className="mt-1 text-[11px] text-ink-secondary">Total RWA Onchain AUM</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded border border-line/60 px-2 py-2">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatUsdCompact(official.activeMcapUsd)}
                  </p>
                  <p className="text-[9px] text-ink-muted">Active AUM</p>
                </div>
                <div className="rounded border border-line/60 px-2 py-2">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatUsdCompact(official.defiActiveTvlUsd)}
                  </p>
                  <p className="text-[9px] text-ink-muted">DeFi Active TVL</p>
                </div>
                <div className="rounded border border-line/60 px-2 py-2">
                  <p
                    className={`text-sm font-semibold tabular-nums ${official.issuerCount === null ? "text-ink-muted" : ""}`}
                    title={official.issuerCount === null ? "DeFiLlama dejó de publicar este conteo" : undefined}
                  >
                    {official.issuerCount ?? "N/A"}
                  </p>
                  <p className="text-[9px] text-ink-muted">Asset Issuers</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-muted">KPI de mercado temporalmente no disponible.</p>
          )}

          {hasProtocols && (
            <div className="mt-3 h-44">
              <DonutChart
                items={data.sectors.map((sector) => ({
                  name: sector.name,
                  value: sector.tvlUsd,
                }))}
                formatValue={formatUsdCompact}
                centerLabel="TVL protocolos"
                maxSlices={8}
              />
            </div>
          )}
        </div>

        <div>
          {hasProtocols ? (
            <>
              <div className="mb-3 rounded border border-line/60 bg-card-raised px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                    TVL de protocolos RWA
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatUsdCompact(data.totalUsd)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-ink-muted">
                  Métrica distinta del AUM; agregada por clasificación de protocolo.
                  {official?.classes && " «AUM» es el Active AUM de la clase en DeFiLlama RWA."}
                </p>
              </div>

              <div className="space-y-1.5">
                {visibles.map((sector) => (
                  <div
                    key={sector.name}
                    className="flex items-baseline justify-between gap-3 text-xs"
                  >
                    <span className="min-w-0 truncate text-ink-secondary">{sector.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatUsdCompact(sector.tvlUsd)}
                      <span className="ml-1 text-ink-muted">{sector.sharePct.toFixed(0)}%</span>
                      <span
                        className={`ml-2 ${
                          sector.change7dPct === null
                            ? "text-ink-muted"
                            : sector.change7dPct >= 0
                              ? "text-up"
                              : "text-down"
                        }`}
                      >
                        {formatPct(sector.change7dPct)}
                      </span>
                      {marketOf(sector.name) && (
                        <span
                          className="ml-2 text-[10px] text-ink-muted"
                          title="Active AUM de la clase en el dashboard RWA de DeFiLlama"
                        >
                          AUM {formatUsdCompact(marketOf(sector.name)!.activeMcapUsd)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {data.insights.length > 0 && (
                <ol className="mt-3 space-y-1.5 border-t border-line/60 pt-3">
                  {data.insights.slice(0, 3).map((text, index) => (
                    <li key={text} className="flex gap-2">
                      <span className="mt-px w-3 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink-muted">
                        {index + 1}
                      </span>
                      <span className="text-[12px] leading-relaxed text-ink-secondary">{text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-muted">Desglose de protocolos no disponible.</p>
          )}
        </div>
      </div>

      {data.dashboard.ok && (
        <SourceBadge
          source={data.dashboard.source}
          url={data.dashboard.data.sourceUrl}
          fetchedAt={data.dashboard.fetchedAt}
          stale={data.dashboard.stale}
        />
      )}
      {data.source.ok && (
        <SourceBadge
          source={`${data.source.source} /protocols — TVL y sectores`}
          fetchedAt={data.source.fetchedAt}
          stale={data.source.stale}
        />
      )}
    </div></section>
  );
}
