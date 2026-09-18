"use client";

import { TreemapChart } from "@/components/charts/TreemapChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { SourceBadge, Unavailable } from "@/components/SourceBadge";
import { ChainActivityView } from "@/components/blockchains/ChainActivityView";
import { formatUsdCompact } from "@/lib/format";
import { useHistory } from "@/components/history/HistoryProvider";
import { useBlockchains, GroupChip } from "./useBlockchains";
import { DataCoverage } from "./NetworkAnalysis";

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex-1 rounded-lg border border-line bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] text-ink-secondary">{note}</p>
    </div>
  );
}

export function LandscapeView() {
  const { data, error } = useBlockchains();
  const history = useHistory();

  if (error) return <Unavailable source="DeFiLlama" />;
  if (!data)
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-lg bg-ice/50" />
        <div className="h-96 animate-pulse rounded-lg bg-ice/50" />
      </div>
    );

  const conTvl = data.networks.filter((n) => n.tvlUsd !== null && n.tvlUsd > 0).sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
  const totalTvl = conTvl.reduce((s, n) => s + (n.tvlUsd ?? 0), 0);
  const conStablecoins = data.networks.filter((n) => n.stablecoinSupplyUsd !== null && n.stablecoinSupplyUsd > 0).sort((a, b) => (b.stablecoinSupplyUsd ?? 0) - (a.stablecoinSupplyUsd ?? 0));
  const totalStablecoins = conStablecoins.reduce((s, n) => s + (n.stablecoinSupplyUsd ?? 0), 0);
  const sinTvl = data.networks.filter((n) => n.tvlExcludedReason !== null);

  // reparto por grupo estratégico, que es como el BBIM piensa el universo
  const porGrupo = new Map<string, number>();
  for (const n of conTvl) {
    porGrupo.set(n.group, (porGrupo.get(n.group) ?? 0) + (n.tvlUsd ?? 0));
  }

  return (
    <div className="space-y-4">
      <DataCoverage data={data} />
      <div className="flex flex-wrap gap-3">
        <Kpi
          label="Redes monitoreadas"
          value={String(data.networks.length)}
          note={`${conTvl.length} con TVL observado · ${sinTvl.length} sin TVL comparable`}
        />
        <Kpi
          label="TVL agregado"
          value={data.networks.some(n => n.tvlUsd !== null) ? formatUsdCompact(totalTvl) : "—"}
          note="suma del universo monitoreado, no del mercado completo"
        />
        <Kpi
          label="Concentración"
          value={
            conTvl.length > 0 && totalTvl > 0
              ? `${(((conTvl[0].tvlUsd ?? 0) / totalTvl) * 100).toFixed(0)}%`
              : "—"
          }
          note={conTvl.length > 0 ? `en ${conTvl[0].name}` : "—"}
        />
        <Kpi
          label="Stablecoins en redes"
          value={data.networks.some(n => n.stablecoinSupplyUsd !== null) ? formatUsdCompact(totalStablecoins) : "—"}
          note={`${conStablecoins.length} redes con oferta observable`}
        />
      </div>

      <ChainActivityView result={data.activity} networks={data.networks} />

      {conStablecoins.length > 0 && (
        <section className="rounded-lg border border-line bg-card p-4">
          <h3 className="text-sm font-semibold">Infraestructura monetaria por red</h3>
          <p className="mb-3 text-xs text-ink-secondary">
            Oferta circulante de stablecoins. Mide capital emitido sobre cada red, no volumen de pagos.
          </p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            {conStablecoins.slice(0, 10).map((network) => {
              const share = totalStablecoins > 0
                ? ((network.stablecoinSupplyUsd ?? 0) / totalStablecoins) * 100
                : 0;
              return (
                <div key={network.name}>
                  <div className="flex justify-between gap-3 text-[12px]">
                    <span className="text-ink-secondary">{network.name}</span>
                    <span className="tabular-nums">
                      {formatUsdCompact(network.stablecoinSupplyUsd ?? 0)}
                      <span className="ml-1 text-ink-muted">{share.toFixed(1)}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-ice">
                    <div className="h-full rounded bg-electric" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {data.stablecoinSource.ok && (
            <SourceBadge
              source={`${data.stablecoinSource.source} — oferta por red`}
              fetchedAt={data.stablecoinSource.fetchedAt}
              stale={data.stablecoinSource.stale}
            />
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[7fr_5fr]">
        <section className="rounded-lg border border-line bg-card p-4">
          <h3 className="text-sm font-semibold">Capital depositado en DeFi</h3>
          <p className="mb-3 text-xs text-ink-secondary">
            Tamaño = TVL; no representa usuarios ni pagos. {conTvl.length} redes con capital observado;
            las demás no tienen datos positivos comparables en este corte.
          </p>
          <div className="h-80">
            <TreemapChart
              items={conTvl.map((n) => ({ name: n.name, value: n.tvlUsd ?? 0 }))}
              formatValue={formatUsdCompact}
              mode="categorical"
            />
          </div>
        </section>

        <section className="rounded-lg border border-line bg-card p-4">
          <h3 className="text-sm font-semibold">Reparto por grupo estratégico</h3>
          <p className="mb-3 text-xs text-ink-secondary">
            Los cuatro grupos con los que el BBIM ordena el universo de redes.
          </p>
          <div className="h-56">
            <DonutChart
              items={[...porGrupo.entries()].map(([name, value]) => ({ name, value }))}
              formatValue={formatUsdCompact}
              centerLabel="TVL"
              maxSlices={6}
            />
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Universo monitoreado</h3>
        <p className="mb-3 text-xs text-ink-secondary">
          Las {data.networks.length} redes de la base, con su caso de uso principal y su nivel de
          adopción institucional.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-ink-muted">
                <th className="border-b border-line pb-1.5 pr-3 text-left font-medium">Red</th>
                <th className="border-b border-line px-2 pb-1.5 text-left font-medium">Grupo</th>
                <th className="border-b border-line px-2 pb-1.5 text-right font-medium">TVL</th>
                <th className="border-b border-line px-2 pb-1.5 text-right font-medium">Stablecoins</th>
                <th className="border-b border-line pb-1.5 pl-2 text-left font-medium">
                  Casos de uso principales
                </th>
              </tr>
            </thead>
            <tbody>
              {data.networks.map((n) => (
                <tr
                  key={n.name}
                  onClick={
                    n.llamaName && n.tvlUsd !== null
                      ? () => history.open({ kind: "chain-tvl", id: n.llamaName!, label: n.name })
                      : undefined
                  }
                  className={`group border-b border-line/50 last:border-0 ${
                    n.llamaName && n.tvlUsd !== null ? "cursor-pointer hover:bg-ice/30" : ""
                  }`}
                >
                  <td className="py-2 pr-3 align-top">
                    <span className="font-medium">{n.name}</span>
                    {n.llamaName && n.tvlUsd !== null && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          history.open({ kind: "chain-tvl", id: n.llamaName!, label: n.name });
                        }}
                        aria-label={`Ver histórico del TVL de ${n.name}`}
                        className="ml-1.5 text-[10px] text-core opacity-0 transition-opacity hover:text-electric focus:opacity-100 group-hover:opacity-100"
                      >
                        ↗
                      </button>
                    )}
                    <span className="block text-[10px] text-ink-muted">
                      {n.type} · {n.launchYear}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <GroupChip group={n.group} />
                  </td>
                  <td className="px-2 py-2 text-right align-top tabular-nums">
                    {n.tvlUsd !== null ? (
                      formatUsdCompact(n.tvlUsd)
                    ) : (
                      <span className="text-ink-muted" title={n.tvlExcludedReason ?? undefined}>
                        {n.tvlExcludedReason ? "No comparable" : "Sin dato"}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right align-top tabular-nums">
                    {n.stablecoinSupplyUsd !== null ? (
                      formatUsdCompact(n.stablecoinSupplyUsd)
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="max-w-md py-2 pl-2 align-top text-[12px] leading-relaxed text-ink-secondary">
                    {n.mainUseCases}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.source.ok && (
          <SourceBadge
            source={`${data.source.source} (TVL en vivo) — universo y clasificación curados al ${data.asOf}`}
            fetchedAt={data.source.fetchedAt}
            stale={data.source.stale}
          />
        )}
      </section>
    </div>
  );
}
