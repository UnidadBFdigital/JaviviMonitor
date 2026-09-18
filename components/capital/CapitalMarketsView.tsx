"use client";

import { usePayload } from "@/lib/useSource";
import { useHistory } from "@/components/history/HistoryProvider";
import { QuotesCard, Change } from "./QuotesCard";
import { NewsList } from "@/components/news/NewsList";
import { formatUsdCompact } from "@/lib/format";
import type { Quote } from "@/lib/sources/yahoo";
import type { Headline } from "@/lib/sources/news";
import type { SourceResult } from "@/lib/sources/types";

type Manager = {
  manager: string;
  product: string;
  slug: string;
  aumUsd: number;
  change7dPct: number | null;
};

type Payload = {
  etfs: SourceResult<Quote[]>;
  equities: SourceResult<Quote[]>;
  news: SourceResult<Headline[]>;
  managers: Manager[];
  /** gestoras de la lista sin TVL en /protocols: se nombran, no se omiten */
  uncoveredManagers: { manager: string; product: string; dashboardActiveMcapUsd: number | null }[];
  tokenizedTreasuries: { valueUsd: number; basis: "mcap" | "tvl" } | null;
  rwaSource: { ok: true; source: string; fetchedAt: string } | { ok: false };
};

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex-1 rounded-lg border border-line bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] text-ink-secondary">{note}</p>
    </div>
  );
}

export function CapitalMarketsView() {
  const { data, error } = usePayload<Payload>("/api/capital-markets");
  const history = useHistory();
  const loading = !data && !error;

  const etfs = data?.etfs.ok ? data.etfs.data : [];
  const turnover = etfs.reduce((s, q) => s + (q.turnoverUsd ?? 0), 0);
  const leader = etfs.reduce<Quote | null>(
    (best, q) => (best === null || (q.turnoverUsd ?? 0) > (best.turnoverUsd ?? 0) ? q : best),
    null
  );

  return (
    <div className="space-y-4">
      {etfs.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Kpi
            label="Negociado en ETF (última sesión)"
            value={formatUsdCompact(turnover)}
            note={`${etfs.length} vehículos · volumen × precio, no flujo neto`}
          />
          {leader && (
            <Kpi
              label="ETF más negociado"
              value={leader.symbol}
              note={`${formatUsdCompact(leader.turnoverUsd ?? 0)} en la sesión`}
            />
          )}
          {data?.tokenizedTreasuries && (
            <Kpi
              label={
                data.tokenizedTreasuries.basis === "mcap"
                  ? "Bonos y fondos monetarios tokenizados"
                  : "TVL de treasuries tokenizados"
              }
              value={formatUsdCompact(data.tokenizedTreasuries.valueUsd)}
              note={
                data.tokenizedTreasuries.basis === "mcap"
                  ? "Active AUM · DeFiLlama RWA en vivo"
                  : "TVL de protocolos, no AUM · DeFiLlama en vivo"
              }
            />
          )}
        </div>
      )}

      <QuotesCard
        title="ETF de bitcoin y ether al contado"
        subtitle="El canal por el que la demanda institucional entra sin custodiar cripto directamente."
        result={data?.etfs}
        loading={loading}
      />

      <QuotesCard
        title="Equities con exposición a cripto"
        subtitle="Exchanges, tesorerías corporativas y emisores cotizados — proxy del apetito del mercado público."
        result={data?.equities}
        loading={loading}
      />

      {data && data.managers.length > 0 && (
        <section className="rounded-lg border border-line bg-card p-4">
          <h3 className="text-sm font-semibold">Gestoras tradicionales con producto tokenizado</h3>
          <p className="mb-3 text-xs text-ink-secondary">
            Capital institucional que ya opera on-chain. No son flujos de ETF: es AUM del producto
            tokenizado, leído en vivo de DeFiLlama. Tocá una fila para ver cómo creció.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-ink-muted">
                  <th className="border-b border-line pb-1.5 pr-3 text-left font-medium">Gestora</th>
                  <th className="border-b border-line px-2 pb-1.5 text-left font-medium">Producto</th>
                  <th className="border-b border-line px-2 pb-1.5 text-right font-medium">AUM on-chain</th>
                  <th className="border-b border-line pb-1.5 pl-2 text-right font-medium">7d</th>
                </tr>
              </thead>
              <tbody>
                {data.managers.map((m) => (
                  <tr
                    key={m.product}
                    onClick={() => history.open({ kind: "protocol", id: m.slug, label: `${m.manager} · ${m.product}` })}
                    className="group cursor-pointer border-b border-line/50 last:border-0 hover:bg-ice/30"
                  >
                    <td className="py-1.5 pr-3 font-medium">{m.manager}</td>
                    <td className="px-2 py-1.5 text-ink-secondary">
                      {m.product}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          history.open({ kind: "protocol", id: m.slug, label: `${m.manager} · ${m.product}` });
                        }}
                        aria-label={`Ver histórico del AUM on-chain de ${m.product}`}
                        className="ml-1.5 text-[10px] text-core opacity-0 transition-opacity hover:text-electric focus:opacity-100 group-hover:opacity-100"
                      >
                        ↗
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatUsdCompact(m.aumUsd)}
                    </td>
                    <td className="py-1.5 pl-2 text-right tabular-nums">
                      <Change value={m.change7dPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.uncoveredManagers.length > 0 && (
            <p className="mt-3 text-[11px] leading-relaxed text-ink-secondary">
              Sin TVL en /protocols de DeFiLlama, por eso no figuran en la tabla:{" "}
              {data.uncoveredManagers
                .map((u) =>
                  u.dashboardActiveMcapUsd !== null
                    ? `${u.manager} (${formatUsdCompact(u.dashboardActiveMcapUsd)} de Active AUM en el dashboard RWA)`
                    : u.manager
                )
                .join(" · ")}
              .
            </p>
          )}
          {data.rwaSource.ok && (
            <p className="mt-3 text-[11px] text-ink-muted">
              Fuente: {data.rwaSource.source} · AUM on-chain en vivo
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Capital Markets en las noticias</h3>
        <p className="mb-3 text-xs text-ink-secondary">
          Titulares clasificados como Capital Markets por el motor de News B2B.
        </p>
        {loading && <div className="h-40 animate-pulse rounded bg-ice/50" />}
        {data && <NewsList result={data.news} emptyLabel="Sin titulares de la categoría hoy." />}
      </section>
    </div>
  );
}
