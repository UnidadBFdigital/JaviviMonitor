"use client";

import { usePayload } from "@/lib/useSource";
import { useHistory } from "@/components/history/HistoryProvider";
import { Panel } from "@/components/Panel";
import { BarList } from "@/components/charts/BarList";
import { formatUsdCompact } from "@/lib/format";
import type { StablecoinTotal } from "@/lib/sources/stablecoins";
import type { SourceResult } from "@/lib/sources/types";

type Payload = {
  total: SourceResult<StablecoinTotal>;
};

// Dónde viven los dólares digitales. Es el dato que sostiene el argumento
// comercial: el volumen real de stablecoins no está donde una entidad
// regulada puede operar.
export function StablecoinChainsCard({ limit = 8 }: { limit?: number }) {
  const { data, error } = usePayload<Payload>("/api/stablecoins");
  const history = useHistory();

  const shell = (children: React.ReactNode) => (
    <Panel
      variant="card"
      title="Supply de stablecoins por red"
      href="/blockchains/riesgo"
      linkLabel="Risk Profiles →"
    >
      {children}
    </Panel>
  );

  if (error) return shell(<p className="py-6 text-sm text-ink-muted">No disponible.</p>);
  if (!data) return shell(<div className="bf-shimmer h-72 rounded" />);
  if (!data.total.ok) return shell(<p className="py-6 text-sm text-ink-muted">Dato no disponible.</p>);

  const { byChain, attributedUsd, chainCount, chainCoveragePct } = data.total.data;
  const top = byChain.slice(0, limit);
  const dosPrimeras = top.slice(0, 2).reduce((s, r) => s + r.circulatingUsd, 0);

  return (
    <Panel
      variant="card"
      title="Supply de stablecoins por red"
      subtitle="Desglose de circulante atribuido a cada blockchain; el total de cabecera usa el market cap oficial sin doble conteo."
      href="/blockchains/riesgo"
      linkLabel="Risk Profiles →"
      footer={
        <>
          DeFiLlama <code className="rounded bg-ice px-1">/stablecoinchains</code> · {chainCount}{" "}
          redes · atribuido {formatUsdCompact(attributedUsd)} · cobertura {chainCoveragePct.toFixed(1)}%
        </>
      }
    >
      <BarList
        items={top.map((c) => ({ label: c.chain, value: c.circulatingUsd }))}
        formatValue={formatUsdCompact}
        total={attributedUsd}
        onSelect={(item) => history.open({ kind: "stablecoin-chain", id: item.label, label: item.label })}
      />

      {attributedUsd > 0 && (
        <p className="mt-3 border-t border-line/60 pt-2.5 text-[12px] leading-relaxed text-ink-secondary">
          <span className="font-semibold text-warn">Lectura: </span>
          {top[0]?.chain} y {top[1]?.chain} concentran{" "}
          {((dosPrimeras / attributedUsd) * 100).toFixed(1)}% del circulante atribuido. La conversación con un banco
          empieza acá: dónde está el dinero no siempre coincide con dónde puede operar un regulado.
        </p>
      )}
    </Panel>
  );
}
