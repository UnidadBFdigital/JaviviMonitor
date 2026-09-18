"use client";

import { DonutChart } from "@/components/charts/DonutChart";
import { SourceBadge } from "@/components/SourceBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatUsdCompact, formatPct } from "@/lib/format";
import { SECTOR_CLASS, type RwaClass } from "@/lib/rwaClasses";
import { UNCLASSIFIED, type RwaSector } from "@/lib/rwaSectors";
import { useRwa } from "./useRwa";

/** Desde qué múltiplo el TVL deja de ser una buena aproximación del tamaño. */
const GAP_RATIO = 2;

function sectorColumns(marketOf: (sector: RwaSector) => RwaClass | null): Column<RwaSector>[] {
  return [
    {
      key: "sector",
      header: "Sector",
      required: true,
      value: (s) => s.name,
      render: (s) => (
        <>
          <span className={s.name === UNCLASSIFIED ? "text-ink-muted" : ""}>{s.name}</span>
          <span className="block text-[10px] text-ink-muted">
            {s.protocols} protocolo{s.protocols === 1 ? "" : "s"}
            {s.top.length > 0 && s.name !== UNCLASSIFIED && ` · ${s.top.join(" · ")}`}
          </span>
        </>
      ),
    },
    { key: "tvl", header: "TVL", numeric: true, value: (s) => s.tvlUsd, render: (s) => formatUsdCompact(s.tvlUsd) },
    {
      key: "market",
      header: "Mercado",
      numeric: true,
      value: (s) => marketOf(s)?.activeMcapUsd ?? null,
      render: (s) => {
        const market = marketOf(s);
        if (!market) {
          return (
            <span className="text-ink-muted" title="Sin clase equivalente en el dashboard RWA de DeFiLlama">
              —
            </span>
          );
        }
        return (
          <span
            title={`${market.label} en DeFiLlama RWA: ${formatUsdCompact(market.activeMcapUsd)} de Active AUM, ${formatUsdCompact(market.onchainMcapUsd)} de Onchain AUM, ${market.assets} activos`}
          >
            {formatUsdCompact(market.activeMcapUsd)}
          </span>
        );
      },
    },
    { key: "share", header: "Peso", numeric: true, value: (s) => s.sharePct, render: (s) => `${s.sharePct.toFixed(1)}%` },
    {
      key: "ch7",
      header: "7d",
      numeric: true,
      value: (s) => s.change7dPct,
      render: (s) => (
        <span
          className={
            s.change7dPct === null ? "text-ink-muted" : s.change7dPct >= 0 ? "text-up" : "text-down"
          }
        >
          {formatPct(s.change7dPct)}
        </span>
      ),
    },
  ];
}

// TVL de protocolos RWA repartido por sector, con el Active AUM de la clase
// equivalente al lado. Son dos medidas distintas: el TVL solo cuenta a los
// emisores que DeFiLlama rastrea como protocolo; el AUM, todo lo emitido.
export function RwaSectorsCard() {
  const { data, error } = useRwa();

  if (error)
    return (
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">TVL de protocolos RWA por sector</h3>
        <p className="py-6 text-sm text-ink-muted">No disponible (error de red).</p>
      </section>
    );

  if (!data)
    return (
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">TVL de protocolos RWA por sector</h3>
        <div className="mt-3 h-64 animate-pulse rounded bg-ice/50" />
      </section>
    );

  if (!data.source.ok || data.sectors.length === 0)
    return (
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">TVL de protocolos RWA por sector</h3>
        <p className="py-6 text-sm text-ink-muted">
          Dato no disponible — DeFiLlama sin respuesta.
        </p>
      </section>
    );

  const classes = data.dashboard.ok ? data.dashboard.data.classes : null;
  const classByName = new Map((classes ?? []).map((c) => [c.name, c]));
  const marketOf = (sector: RwaSector) => {
    const cls = SECTOR_CLASS[sector.name];
    return cls ? (classByName.get(cls) ?? null) : null;
  };

  // sectores donde TVL y AUM de la clase se separan: en cualquier
  // dirección, las dos cifras dejan de ser comparables
  const gaps = data.sectors.flatMap((sector) => {
    const market = marketOf(sector);
    if (!market || sector.tvlUsd <= 0 || market.activeMcapUsd <= 0) return [];
    const ratio = market.activeMcapUsd / sector.tvlUsd;
    return ratio >= GAP_RATIO || ratio <= 1 / GAP_RATIO ? [{ sector, market, ratio }] : [];
  });

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">TVL de protocolos RWA por sector</h3>
        <p className="text-lg font-bold tabular-nums">{formatUsdCompact(data.totalUsd)}</p>
      </div>
      <p className="text-xs text-ink-secondary">
        Clasificación propia sobre protocolos RWA/RWA Lending de DeFiLlama. El TVL solo cuenta a los
        emisores que DeFiLlama rastrea como protocolo
        {classes ? "; «Mercado» es el Active AUM de la clase equivalente en su dashboard RWA." : "."}
      </p>

      {gaps.length > 0 && (
        <div className="mt-2 rounded border border-warn/40 bg-warn/5 px-3 py-2 text-[11px] leading-relaxed text-ink-secondary">
          <p className="font-semibold text-warn">El TVL no es el tamaño del mercado</p>
          <ul className="mt-1 space-y-0.5">
            {gaps.map(({ sector, market, ratio }) => (
              <li key={sector.name}>
                {sector.name}: {formatUsdCompact(sector.tvlUsd)} de TVL frente a{" "}
                {formatUsdCompact(market.activeMcapUsd)} de Active AUM{" "}
                {ratio >= 1
                  ? `(${ratio.toFixed(1)}× mayor). No todos los emisores de la clase reportan TVL en /protocols.`
                  : `(el TVL es ${(1 / ratio).toFixed(1)}× mayor). Son perímetros distintos: no conviene comparar las dos cifras.`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 h-52">
        <DonutChart
          items={data.sectors.map((s) => ({ name: s.name, value: s.tvlUsd }))}
          formatValue={formatUsdCompact}
          centerLabel="TVL protocolos"
          maxSlices={8}
        />
      </div>

      <div className="mt-4">
        {/* sin orden inicial: «Sin clasificar» queda al final, como residuo */}
        <DataTable
          rows={data.sectors}
          columns={sectorColumns(marketOf)}
          exportName="rwa-sectores"
          maxHeight="max-h-[22rem]"
          rowHistory={(s) => ({ kind: "rwa-sector", id: s.name, label: s.name })}
        />
        <p className="mt-1.5 text-[10px] text-ink-muted">
          Tocá un sector para ver cómo evolucionó su TVL y qué protocolos lo explican. «—» en Mercado:
          el sector no tiene una clase equivalente en DeFiLlama.
        </p>
      </div>

      {data.insights.length > 0 && (
        <div className="mt-4 border-t border-line/60 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-electric">
            Lecturas del sector
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

      {data.source.ok && (
        <SourceBadge
          source={`${data.source.source} — clasificación por sector propia${classes ? " · AUM: DeFiLlama RWA" : ""}`}
          fetchedAt={data.source.fetchedAt}
          stale={data.source.stale}
        />
      )}
    </section>
  );
}
