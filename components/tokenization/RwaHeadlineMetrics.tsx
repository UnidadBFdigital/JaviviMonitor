"use client";

import { BarList } from "@/components/charts/BarList";
import { SourceBadge } from "@/components/SourceBadge";
import { formatUsdCompact } from "@/lib/format";
import { useRwa } from "./useRwa";

export function RwaHeadlineMetrics() {
  const { data, error } = useRwa();

  if (!data && !error) {
    return <div className="h-28 animate-pulse rounded-lg bg-ice/50" />;
  }

  if (error || !data?.dashboard.ok) {
    return (
      <section className="rounded-lg border border-line bg-card p-4">
        <p className="text-sm font-semibold">Mercado RWA de DeFiLlama</p>
        <p className="mt-2 text-sm text-ink-muted">
          Los totales oficiales no están disponibles en este momento. La vista de protocolos sigue
          debajo como una cobertura independiente.
        </p>
      </section>
    );
  }

  const { data: metrics } = data.dashboard;
  // rótulos idénticos a los de la cabecera de DeFiLlama. El conteo de emisores
  // salió de su página en 2026: si no está, la tarjeta no se muestra
  const items: [string, string][] = [
    ["Total RWA Active AUM", formatUsdCompact(metrics.activeMcapUsd)],
    ["Total RWA Onchain AUM", formatUsdCompact(metrics.onchainMcapUsd)],
    ["DeFi Active TVL", formatUsdCompact(metrics.defiActiveTvlUsd)],
  ];
  if (metrics.issuerCount !== null) items.push(["Total Asset Issuers", metrics.issuerCount.toLocaleString("en-US")]);

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className={`grid gap-2 ${items.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
        {items.map(([label, value]) => (
          <div key={label} className="rounded border border-line/70 bg-card-raised px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              {label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums leading-none">{value}</p>
          </div>
        ))}
      </div>

      {metrics.classes && metrics.classes.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Active AUM por clase de activo
          </p>
          <BarList
            items={metrics.classes.slice(0, 8).map((c) => ({
              label: c.label,
              value: c.activeMcapUsd,
              note: `${formatUsdCompact(c.onchainMcapUsd)} on-chain · ${c.assets.toLocaleString("es-BO")} activos`,
            }))}
            formatValue={formatUsdCompact}
            total={metrics.activeMcapUsd}
          />
          <p className="mt-1.5 text-[10px] leading-relaxed text-ink-muted">
            Clasificación de DeFiLlama. Un activo puede estar en más de una clase, así que las barras no
            suman el total. Es el AUM de lo emitido: no es el TVL de protocolos por sector.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[10px] text-ink-muted">
          El desglose por clase no llegó en esta consulta: la fuente solo devolvió los totales.
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-secondary">
        Perímetro por defecto de DefiLlama: excluye stablecoins, governance tokens y RWA perps;
        incluye Bridge/Interop TVL. AUM y TVL no son intercambiables.
      </p>
      <SourceBadge
        source={data.dashboard.source}
        url={metrics.sourceUrl}
        fetchedAt={data.dashboard.fetchedAt}
        stale={data.dashboard.stale}
      />
    </section>
  );
}
