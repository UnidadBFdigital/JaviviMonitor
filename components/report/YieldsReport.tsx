"use client";

import { formatUsdCompact } from "@/lib/format";
import { OPERATION_BY_ID, type YieldPool } from "@/lib/yields";
import type { YieldsReportPayload } from "@/lib/yieldsPayload";
import { OPERATION_COLOR, formatApy } from "@/components/yields/atoms";
import { BarRows, Chart, Donut, Legend, RangeRows, STATUS, StackedShare, W_FULL, W_HALF } from "./ReportCharts";
import { ReportFig, ReportSection } from "./ReportParts";

// Capítulo 10 · DeFi Yields. La foto del rendimiento disponible en DeFi al
// generar el informe: qué es normal por tipo de operación, dónde está el
// capital, qué pools lideran con señales bajas y cuánto del universo levanta
// señales de riesgo. Todo sale del mismo universo que muestra el explorador.

const usd = (value: number) => formatUsdCompact(value);
const stamp = (iso: string) => new Date(iso).toLocaleString("es-BO");

function poolLabel(pool: YieldPool): string {
  return `${pool.projectName} · ${pool.symbol}`;
}

export function YieldsReport({ data, failed }: { data: YieldsReportPayload | null; failed: boolean }) {
  if (!data || !data.ok) {
    return (
      <ReportSection code="10" layer="Capa 2 · Actividad económica" title="DeFi Yields: dónde rinde el capital" pageBreak>
        <p>
          {failed || (data && !data.ok)
            ? "DeFiLlama Yields no respondió al generar el informe. Este capítulo no está disponible en este corte."
            : "Preparando los rendimientos DeFi…"}
        </p>
      </ReportSection>
    );
  }

  const { pulse, operations, featured, byAsset, mix, universe } = data;
  const ranged = operations
    .filter((o) => o.count >= 3 && o.median !== null && o.p25 !== null && o.p75 !== null)
    .sort((a, b) => (b.median ?? 0) - (a.median ?? 0));
  const capital = operations
    .filter((o) => o.tvlUsd > 0)
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .map((o) => ({ label: OPERATION_BY_ID.get(o.id)!.label, value: o.tvlUsd, color: OPERATION_COLOR[o.id] }));
  const capitalTotal = capital.reduce((sum, c) => sum + c.value, 0);
  const riskTotal = mix.risk.low + mix.risk.medium + mix.risk.high;

  return (
    <ReportSection
      code="10"
      layer="Capa 2 · Actividad económica"
      title="DeFi Yields: dónde rinde el capital"
      lead={`Cuánto paga hoy DeFi por prestar, hacer staking, proveer liquidez o fijar una tasa: ${universe.pools.toLocaleString("es-BO")} pools con más de $100k depositados, ${usd(universe.tvlUsd)} en total. El APY es anualizado y variable: describe el día del informe, no promete el año.`}
      pageBreak
    >
      <div className="bf-rp-figs">
        <ReportFig
          value={formatApy(pulse.dollarMedianApy)}
          label="Dólares, lo típico"
          note={`mediana de ${pulse.dollarPools} pools de stablecoins con señales bajas`}
        />
        <ReportFig
          value={formatApy(pulse.ethStaking?.apy ?? null)}
          label="Staking de ETH"
          note={pulse.ethStaking?.name ?? "sin referencia"}
        />
        <ReportFig
          value={formatApy(pulse.solStaking?.apy ?? null)}
          label="Staking de SOL"
          note={pulse.solStaking?.name ?? "sin referencia"}
        />
        <ReportFig
          value={formatApy(pulse.btcMedianApy)}
          label="BTC, lo típico"
          note={`mediana de ${pulse.btcPools} pools; el BTC se usa sobre todo como colateral`}
        />
      </div>

      <Chart
        wide
        title="¿Cuánto rinde cada tipo de operación?"
        note="La barra va del percentil 25 al 75: la mitad central de los pools rinde dentro de ese tramo. El punto es la mediana. Perfil equilibrado: sin señales altas y más de $1M depositados."
      >
        <RangeRows
          width={W_FULL}
          rows={ranged.map((o) => ({
            label: OPERATION_BY_ID.get(o.id)!.label,
            low: o.p25!,
            mid: o.median!,
            high: o.p75!,
            color: OPERATION_COLOR[o.id],
            sub: `${o.count} pools`,
          }))}
          format={(v) => formatApy(v)}
        />
      </Chart>

      <div className="bf-rp-duo">
        <Chart
          title="Dónde está el capital"
          note="TVL por tipo de operación, perfil equilibrado."
          legend={
            <Legend
              columns
              items={capital.slice(0, 7).map((c) => ({
                label: c.label,
                color: c.color,
                value: `${usd(c.value)} · ${((c.value / capitalTotal) * 100).toFixed(0)}%`,
              }))}
            />
          }
        >
          <div className="bf-rp-center-x">
            <Donut items={capital} centerValue={usd(capitalTotal)} centerLabel="depositados" />
          </div>
        </Chart>

        <Chart
          title="Señales de riesgo del universo"
          note={`Reglas visibles sobre capital, historial, incentivos y APY atípico, sobre los ${riskTotal.toLocaleString("es-BO")} pools. No auditan contratos.`}
        >
          <StackedShare
            width={W_HALF}
            height={28}
            items={[
              { label: "Señales bajas", value: mix.risk.low, color: STATUS.up },
              { label: "Señales medias", value: mix.risk.medium, color: STATUS.warn },
              { label: "Señales altas", value: mix.risk.high, color: STATUS.down },
            ]}
          />
          {/* la leyenda va pegada a la barra que explica, antes de la nota de plazos */}
          <Legend
            columns
            items={[
              { label: "Señales bajas", color: STATUS.up, value: mix.risk.low.toLocaleString("es-BO") },
              { label: "Señales medias", color: STATUS.warn, value: mix.risk.medium.toLocaleString("es-BO") },
              { label: "Señales altas", color: STATUS.down, value: mix.risk.high.toLocaleString("es-BO") },
            ]}
          />
          <div className="bf-rp-note" style={{ marginTop: 12 }}>
            <h4>Plazos que publica la fuente</h4>
            <p>
              {mix.terms.maturity} pools vencen en una fecha (tasa fija o liquidez con vencimiento), {mix.terms.exit} piden
              esperar días para retirar y {mix.terms.lock} bloquean el depósito. El resto no publica plazo, que no es lo
              mismo que no tenerlo.
            </p>
          </div>
        </Chart>
      </div>

      <Chart
        wide
        title="La mejor opción de cada tipo de operación"
        note="Mayor APY de cada operación entre pools con más de $10M, sin pérdida impermanente y con señales de riesgo bajas. A la derecha, operación, red y capital depositado."
      >
        {featured.length > 0 ? (
          <BarRows
            width={W_FULL}
            gutter={170}
            subWidth={210}
            format={(v) => formatApy(v)}
            items={featured.map((pool) => ({
              label: poolLabel(pool),
              value: pool.apy,
              color: OPERATION_COLOR[pool.operation],
              sub: `${OPERATION_BY_ID.get(pool.operation)!.label} · ${pool.chain} · ${usd(pool.tvlUsd)}`,
            }))}
          />
        ) : (
          <p className="bf-rp-muted">Ningún pool cumple las condiciones en este corte.</p>
        )}
      </Chart>

      <h3>Mejores opciones conservadoras por activo</h3>
      <div className="bf-rp-duo">
        {byAsset.map(({ asset, label, pools }) => (
          <Chart
            key={asset}
            title={label}
            note="Señales bajas, sin pérdida impermanente, más de $10M. Uno por protocolo."
          >
            {pools.length > 0 ? (
              <BarRows
                width={W_HALF}
                gutter={124}
                valueWidth={52}
                subWidth={62}
                rowH={20}
                format={(v) => formatApy(v)}
                items={pools.map((pool) => ({
                  label: poolLabel(pool),
                  value: pool.apy,
                  color: OPERATION_COLOR[pool.operation],
                  sub: pool.chain,
                }))}
              />
            ) : (
              <p className="bf-rp-muted">Sin pools conservadores para este activo.</p>
            )}
          </Chart>
        ))}
      </div>

      <div className="bf-rp-note">
        <h4>Cómo leer estos rendimientos</h4>
        <p>
          El APY base sale de la actividad real del pool; los incentivos se pagan en tokens del protocolo y pueden bajar o
          terminar. Proveer liquidez con dos activos expone a pérdida impermanente. Una tasa fija solo es fija si se espera
          al vencimiento. Las señales de riesgo son reglas sobre datos públicos, no una auditoría del contrato.
        </p>
        <p>
          Se excluyen {universe.withoutYield.toLocaleString("es-BO")} pools que hoy rinden 0% (colateral sin interés) de los{" "}
          {universe.published.toLocaleString("es-BO")} que publica la fuente.
          {!universe.borrowRates && " La tasa para pedir prestado no respondió en este corte."} Nada de esto es una
          recomendación de inversión.
        </p>
        <p className="bf-rp-muted">
          Fuente: DeFiLlama Yields · consultada el {stamp(data.fetchedAt)}
          {data.stale ? " · último valor válido en caché" : ""}
        </p>
      </div>
    </ReportSection>
  );
}
