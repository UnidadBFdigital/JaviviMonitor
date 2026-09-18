"use client";

import { formatUsdCompact } from "@/lib/format";
import { useRwa } from "./useRwa";

// Evita mezclar el AUM on-chain, el AUM activo y el TVL. Las tres métricas son
// útiles, pero responden preguntas distintas. Los rótulos son los de DeFiLlama,
// que en septiembre de 2026 pasó de "Mcap" a "AUM" sin cambiar la medida.
export function RwaCoverageNote() {
  const { data } = useRwa();

  if (!data?.dashboard.ok || !data.source.ok || data.totalUsd <= 0) return null;

  const metrics = data.dashboard.data;

  return (
    <section className="rounded-lg border border-line bg-card-raised p-4">
      <h3 className="text-sm font-semibold">Cómo leer las cifras RWA sin mezclarlas</h3>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded border border-line/70 bg-card px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Onchain AUM
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums leading-none">
            {formatUsdCompact(metrics.onchainMcapUsd)}
          </p>
          <p className="mt-1.5 text-[10px] text-ink-muted">valor de los activos emitidos on-chain</p>
        </div>

        <div className="rounded border border-line/70 bg-card px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Active AUM
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums leading-none">
            {formatUsdCompact(metrics.activeMcapUsd)}
          </p>
          <p className="mt-1.5 text-[10px] text-ink-muted">la parte que DeFiLlama considera activa</p>
        </div>

        <div className="rounded border border-line/70 bg-card px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            TVL de protocolos RWA
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums leading-none">
            {formatUsdCompact(data.totalUsd)}
          </p>
          <p className="mt-1.5 text-[10px] text-ink-muted">
            suma de /protocols · RWA y RWA Lending
          </p>
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-ink-secondary">
        <strong className="text-ink">Onchain AUM</strong> mide el valor de los activos emitidos;
        <strong className="text-ink"> Active AUM</strong> aplica el criterio de actividad de
        DefiLlama; y <strong className="text-ink">TVL</strong> mide capital depositado en protocolos.
        Un mismo activo puede circular fuera de DeFi o aparecer en distintos protocolos, por lo que
        no corresponde restar, sumar ni interpretar su cociente como cobertura del mercado.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
        El gráfico sectorial y la variación semanal de abajo usan exclusivamente TVL de protocolos.
        Para citar el tamaño del mercado RWA de DefiLlama, usa los KPI oficiales de la cabecera.
        Hasta septiembre de 2026 DefiLlama los llamaba «Mcap»; la medida es la misma.
      </p>
    </section>
  );
}
