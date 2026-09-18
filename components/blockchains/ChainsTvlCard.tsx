"use client";

import { Panel } from "@/components/Panel";
import { BarList } from "@/components/charts/BarList";
import { formatUsdCompact } from "@/lib/format";
import { useHistory } from "@/components/history/HistoryProvider";
import { useBlockchains } from "./useBlockchains";

// Barras horizontales de TVL por red. Elegido sobre un treemap a propósito:
// con Ethereum concentrando ~56%, el treemap deja al resto ilegible y acá lo
// que importa es poder comparar las redes chicas entre sí.
export function ChainsTvlCard({ limit = 10 }: { limit?: number }) {
  const { data, error } = useBlockchains();
  const history = useHistory();

  const shell = (children: React.ReactNode, footer?: React.ReactNode) => (
    <Panel
      variant="card"
      title="TVL por red"
      href="/blockchains"
      linkLabel="Landscape →"
      footer={footer}
    >
      {children}
    </Panel>
  );

  if (error) return shell(<p className="py-6 text-sm text-ink-muted">No disponible.</p>);
  if (!data) return shell(<div className="bf-shimmer h-72 rounded" />);

  const conTvl = data.networks
    .filter((n) => n.tvlUsd !== null && n.tvlUsd > 0)
    .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
  const total = conTvl.reduce((s, n) => s + (n.tvlUsd ?? 0), 0);

  return (
    <Panel
      variant="card"
      title="TVL por red"
      subtitle={`Dónde está la actividad económica real. Las ${conTvl.length} redes con TVL público del universo BBIM suman ${formatUsdCompact(total)}.`}
      href="/blockchains"
      linkLabel="Landscape →"
      footer="DeFiLlama en vivo · las redes permissioned no publican TVL y quedan fuera de este gráfico"
    >
      <BarList
        items={conTvl.slice(0, limit).map((n) => ({ label: n.name, value: n.tvlUsd ?? 0 }))}
        formatValue={formatUsdCompact}
        total={total}
        onSelect={(_, index) => {
          const network = conTvl[index];
          if (network?.llamaName) {
            history.open({ kind: "chain-tvl", id: network.llamaName, label: network.name });
          }
        }}
      />
    </Panel>
  );
}
