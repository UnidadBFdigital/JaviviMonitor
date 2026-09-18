"use client";

import { ChartFrame } from "@/components/charts/ChartFrame";
import { HeatGrid } from "@/components/charts/HeatGrid";
import { formatTimestamp } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { usePayload } from "@/lib/useSource";

type Correlations = {
  ok: boolean;
  labels: string[];
  matrix: (number | null)[][];
  unavailable: string[];
  window: string;
  sources: string;
  fetchedAt: string;
};

export default function CorrelacionesPage() {
  const { data, error } = usePayload<Correlations>("/api/correlations");

  return (
    <div className="space-y-4">
      <div>
        <PageHeader
          eyebrow="Market Data"
          title="Correlation Lab"
          subtitle="Correlación de Pearson sobre retornos log diarios — cripto vs macro tradicional."
        />
      </div>
      <ChartFrame
        title="Matriz de correlación"
        subtitle={data?.window ?? "90 días"}
        source={data?.sources ?? "Crypto.com · Stooq"}
        fetchedAt={data?.fetchedAt}
        loading={!data && !error}
        error={error || data?.ok === false ? "no disponible" : null}
        height="h-auto"
        exportRows={
          data
            ? data.labels.map((l, i) => ({
                serie: l,
                ...Object.fromEntries(data.labels.map((c, j) => [c, data.matrix[i][j]])),
              }))
            : undefined
        }
        exportName="correlaciones"
      >
        {data && (
          <div className="py-2">
            <HeatGrid rows={data.labels} cols={data.labels} values={data.matrix} />
            {data.unavailable.length > 0 && (
              <p className="mt-3 text-[11px] text-ink-muted">
                Series no disponibles (fuente sin respuesta): {data.unavailable.join(", ")}
              </p>
            )}
            <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-ink-muted">
              Verde = correlación positiva, azul = negativa. Los mercados tradicionales no operan
              fines de semana: la correlación se calcula solo sobre los días comunes. USDT no se
              incluye — su precio ancla en $1 y la correlación de retornos no es informativa.
            </p>
            {data && (
              <p className="mt-1 text-[10px] text-ink-muted">
                Consultado {formatTimestamp(data.fetchedAt)}
              </p>
            )}
          </div>
        )}
      </ChartFrame>
    </div>
  );
}
