"use client";

import type { NetworksPayload } from "@/components/networks/useNetworkIntel";
import {
  buildResearchSignals,
  computeMomentum,
  INDEX_NAME,
  INDEX_VERSION,
  PILLARS,
  PROFILES,
  scoreUniverse,
  toolingScore,
} from "@/lib/networks/score";
import { activeAddresses, feesPerActiveUser } from "@/lib/networks/series";
import type { NetworkMetrics } from "@/lib/networks/types";
import { formatUsdCompact } from "@/lib/format";
import {
  BarRows,
  CATEGORICAL,
  Chart,
  DivergingBars,
  GOLD,
  Legend,
  Quadrant,
  ScoreMatrix,
  StackedShare,
  W_FULL,
  W_HALF,
  W_THIRD,
} from "./ReportCharts";
import { ReportFig, ReportSection } from "./ReportParts";

// Capítulos 07 a 09 · Builder Radar. El mismo motor que la pantalla, impreso en
// gráficos: puntaje y pilares, costo y tendencia, desarrollo, stack y casos de
// uso. Solo entran datos que existen para todas las redes; el detalle que solo
// publica growthepie para Ethereum y sus L2 va rotulado como tal.

const LAYER = "Builder Radar";

const usd = (v: number) => formatUsdCompact(v);
const count = (v: number) => v.toLocaleString("es-BO", { maximumFractionDigits: 0 });
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
const cost = (v: number) =>
  v === 0 ? "$0" : v < 0.0001 ? "<$0.0001" : v < 1 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;

function leader<T>(items: T[], value: (item: T) => number | null, highest = true): T | null {
  let best: T | null = null;
  let bestValue: number | null = null;
  for (const item of items) {
    const v = value(item);
    if (v === null) continue;
    if (bestValue === null || (highest ? v > bestValue : v < bestValue)) {
      best = item;
      bestValue = v;
    }
  }
  return best;
}

/** Ficha técnica compacta: solo lo que la red documenta, sin casillas vacías. */
function NetCard({ network }: { network: NetworkMetrics }) {
  const rows: [string, string][] = [["Token de gas", network.gasToken]];
  if (network.arch.blockTimeSec !== null) rows.push(["Tiempo de bloque", `${network.arch.blockTimeSec} s`]);
  if (network.arch.finalitySec !== null) rows.push(["Finalidad", `${network.arch.finalitySec} s`]);
  if (network.settlesOn) rows.push(["Liquida en", network.settlesOn]);
  if (network.arch.stage) rows.push(["Stage L2BEAT", network.arch.stage]);
  if (network.arch.dataAvailability) rows.push(["Datos", network.arch.dataAvailability]);
  if (network.tooling.oracles.length > 0) rows.push(["Oráculos", network.tooling.oracles.slice(0, 3).join(", ")]);
  if (network.tooling.indexers.length > 0) rows.push(["Indexadores", network.tooling.indexers.slice(0, 2).join(", ")]);
  return (
    <article className="bf-rp-netcard">
      <h4>
        {network.name}
        <span>
          {network.layer} · {network.vm} · {network.language}
        </span>
      </h4>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div>
          <dt>Acceso</dt>
          <dd>
            <a href={network.docs}>docs</a>
            {network.faucet && (
              <>
                {" · "}
                <a href={network.faucet}>faucet</a>
              </>
            )}
            {network.grants && (
              <>
                {" · "}
                <a href={network.grants}>grants</a>
              </>
            )}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function BuildCostReport({ data, failed }: { data: NetworksPayload | null; failed: boolean }) {
  if (!data) {
    return (
      <ReportSection code="07" layer={LAYER} title="Builder Radar: dónde construir" pageBreak>
        <p>
          {failed
            ? "La fuente del Builder Radar no respondió. Este bloque no está disponible en este corte."
            : "Preparando los datos del Builder Radar…"}
        </p>
      </ReportSection>
    );
  }

  const networks = data.networks;
  const scores = scoreUniverse(networks, "general");
  const scoreOf = (n: NetworkMetrics) => scores.get(n.id)?.score ?? null;
  const pillarOf = (n: NetworkMetrics, id: string) =>
    scores.get(n.id)?.pillars.find((p) => p.id === id)?.score ?? null;
  const momentum = computeMomentum(networks, 30);
  const ranked = [...networks].sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1));

  const best = ranked[0];
  const bestScore = best ? scoreOf(best) : null;
  const cheapest = leader(networks, (n) => feesPerActiveUser(n).value, false);
  const mostUsers = leader(networks, (n) => activeAddresses(n).value);
  const mostTvl = leader(networks, (n) => n.liquidity.tvlUsd);

  const byFees = networks
    .map((n) => ({ n, fee: feesPerActiveUser(n).value }))
    .filter((e): e is { n: NetworkMetrics; fee: number } => e.fee !== null)
    .sort((a, b) => a.fee - b.fee);
  const byTrend = [...networks].sort(
    (a, b) => (b.liquidity.tvlChange30dPct ?? -Infinity) - (a.liquidity.tvlChange30dPct ?? -Infinity)
  );
  const quadrant = networks.flatMap((n) => {
    const econ = pillarOf(n, "economic");
    const use = pillarOf(n, "adoption");
    return econ === null || use === null
      ? []
      : [{ x: Math.round(econ) / 10, y: Math.round(use) / 10, label: n.name, size: n.liquidity.tvlUsd ?? 0 }];
  });
  const evm = networks
    .filter((n) => n.cost.medianUsd !== null)
    .sort((a, b) => (a.cost.medianUsd ?? 0) - (b.cost.medianUsd ?? 0));
  const evmMonthly = evm.filter((n) => n.cost.avg30dUsd !== null);

  const withCommits = networks
    .filter((n) => n.dev.commits12w !== null)
    .sort((a, b) => (b.dev.commits12w ?? 0) - (a.dev.commits12w ?? 0));
  // una cuota agotada deja a todas las redes con el mismo motivo: se imprime
  // una vez con la lista de redes, no quince veces
  const missingReasons = new Map<string, string[]>();
  for (const n of networks.filter((x) => x.dev.commits12w === null)) {
    const reason = n.dev.unavailable ?? "GitHub no devolvió datos";
    missingReasons.set(reason, [...(missingReasons.get(reason) ?? []), n.name]);
  }
  const byTooling = [...networks].sort((a, b) => toolingScore(b) - toolingScore(a));
  const bySecurity = networks
    .filter((n) => n.arch.securityScore !== null)
    .sort((a, b) => (b.arch.securityScore ?? 0) - (a.arch.securityScore ?? 0));

  const signals = buildResearchSignals(networks, momentum, 30, 4);

  return (
    <>
      {/* ── 07 Dónde construir ──────────────────────────────────── */}
      <ReportSection
        code="07"
        layer={LAYER}
        title="Builder Radar: dónde construir"
        lead={`${data.universe} redes medidas con la misma vara: cuánto cuesta usarlas, cuántos usuarios y cuánto capital tienen, qué tan fácil es desarrollar y qué seguridad ofrecen. ${INDEX_NAME} ${INDEX_VERSION}, perfil general.`}
        pageBreak
      >
        <div className="bf-rp-figs">
          <ReportFig
            value={best && bestScore !== null ? `${best.name} · ${bestScore.toFixed(0)}` : "—"}
            label={`Mejor ${INDEX_NAME}`}
            note="perfil general, sobre 100"
          />
          <ReportFig
            value={cheapest ? cost(feesPerActiveUser(cheapest).value!) : "—"}
            label="Menor comisión por usuario"
            note={cheapest ? `${cheapest.name} · comisiones 24h ÷ usuarios` : undefined}
          />
          <ReportFig
            value={mostUsers ? count(activeAddresses(mostUsers).value!) : "—"}
            label="Más usuarios activos"
            note={mostUsers ? `${mostUsers.name} · direcciones en 24h` : undefined}
          />
          <ReportFig
            value={mostTvl?.liquidity.tvlUsd ? usd(mostTvl.liquidity.tvlUsd) : "—"}
            label="Más capital en DeFi"
            note={mostTvl?.name}
            spark={mostTvl?.history.tvl.slice(-30).map((p) => p.value)}
            positive={(mostTvl?.liquidity.tvlChange30dPct ?? 0) >= 0}
          />
        </div>

        <Chart
          wide
          title={`${INDEX_NAME} por red`}
          note="0 a 100, perfil general: costo 25% · desarrollo 25% · uso 20% · capital 20% · seguridad 10%. La escala es relativa a las redes medidas."
        >
          <BarRows
            width={W_FULL}
            gutter={120}
            subWidth={96}
            format={(v) => v.toFixed(0)}
            items={ranked
              .filter((n) => scoreOf(n) !== null)
              .map((n) => ({ label: n.name, value: scoreOf(n)!, color: GOLD, sub: `${n.layer} · ${n.vm}` }))}
          />
        </Chart>

        <Chart
          wide
          title="Los cinco pilares, red por red"
          note="Cada celda va de 0 a 100 dentro de su pilar; más intenso es mejor. La primera columna es el puntaje final."
        >
          <ScoreMatrix
            max={100}
            digits={0}
            badgeLabel="Score"
            cols={PILLARS.map((p) => p.short)}
            rows={ranked.map((n) => ({
              label: n.name,
              badge: scoreOf(n) === null ? "—" : scoreOf(n)!.toFixed(0),
              cells: PILLARS.map((p) => pillarOf(n, p.id)),
            }))}
          />
        </Chart>

        <div className="bf-rp-duo">
          <Chart
            title="Cuánto gasta un usuario activo al día"
            note="Comisiones de red de 24h ÷ direcciones activas. No es el costo de una transacción. Escala logarítmica."
          >
            <BarRows
              log
              width={W_HALF}
              gutter={86}
              valueWidth={60}
              subWidth={58}
              rowH={20}
              format={cost}
              items={byFees.map(({ n, fee }) => ({
                label: n.name,
                value: fee,
                sub: n.liquidity.chainFees24hUsd === null ? undefined : `${usd(n.liquidity.chainFees24hUsd)}/día`,
              }))}
            />
          </Chart>
          <Chart title="Tendencia del capital · 30 días" note="Variación del TVL en DeFi de cada red.">
            <DivergingBars
              width={W_HALF}
              gutter={86}
              rowH={20}
              format={pct}
              items={byTrend.map((n) => ({ label: n.name, value: n.liquidity.tvlChange30dPct }))}
            />
          </Chart>
        </div>

        <Chart
          wide
          title="Mapa: uso real frente a costo de uso"
          note="Pilares del índice en escala 0-10. A la derecha, más barato para el usuario; arriba, más uso. El tamaño de cada punto es su TVL."
        >
          <Quadrant
            points={quadrant}
            xLabel="Costo de uso (10 = más barato)"
            yLabel="Uso real"
            quadrants={["Mucho uso, cara", "Mucho uso y barata", "Poco uso y cara", "Barata, falta uso"]}
            height={280}
          />
        </Chart>

        {evm.length > 0 && (
          <>
            <h3>Detalle EVM: costo por transacción</h3>
            <div className="bf-rp-duo">
              <Chart
                title="Costo mediano por transacción"
                note={`Último día publicado por growthepie. Solo Ethereum y sus L2 (${evm.length} redes); las demás no publican esta medida. Escala logarítmica.`}
              >
                <BarRows
                  log
                  width={W_HALF}
                  gutter={86}
                  valueWidth={62}
                  subWidth={70}
                  rowH={20}
                  format={cost}
                  items={evm.map((n) => ({
                    label: n.name,
                    value: n.cost.medianUsd!,
                    sub: n.cost.avg30dUsd === null ? undefined : `30d ${cost(n.cost.avg30dUsd)}`,
                  }))}
                />
              </Chart>
              <Chart
                title="Gasto mensual con 100.000 transacciones"
                note="Cantidad × media de medianas de 30 días. Referencia orientativa: excluye infraestructura, RPC y puentes. Escala logarítmica."
              >
                <BarRows
                  log
                  width={W_HALF}
                  gutter={86}
                  valueWidth={62}
                  rowH={20}
                  format={usd}
                  items={evmMonthly.map((n) => ({ label: n.name, value: n.cost.avg30dUsd! * 100_000 }))}
                />
              </Chart>
            </div>
          </>
        )}
      </ReportSection>

      {/* ── 08 Desarrollo y arquitectura ───────────────────────── */}
      <ReportSection
        code="08"
        layer={LAYER}
        title="Builder Radar: desarrollo y arquitectura"
        lead="Qué tan activo está el desarrollo de cada red, qué herramientas ofrece a quien construye y sobre qué arquitectura corre."
        pageBreak
      >
        {withCommits.length > 0 && (
          <div className="bf-rp-duo">
            <Chart
              title="Commits del repositorio núcleo · 12 semanas"
              note="Mide el repositorio principal de cada red, no a todos sus desarrolladores."
            >
              <BarRows
                width={W_HALF}
                gutter={86}
                valueWidth={48}
                subWidth={52}
                rowH={20}
                format={count}
                items={withCommits.map((n) => ({
                  label: n.name,
                  value: n.dev.commits12w!,
                  sub: n.dev.commitsChangePct === null ? undefined : pct(n.dev.commitsChangePct),
                }))}
              />
            </Chart>
            <Chart title="Ritmo de desarrollo" note="Commits de las últimas 12 semanas contra las 12 anteriores.">
              <DivergingBars
                width={W_HALF}
                gutter={86}
                rowH={20}
                format={pct}
                items={[...networks]
                  .sort((a, b) => (b.dev.commitsChangePct ?? -Infinity) - (a.dev.commitsChangePct ?? -Infinity))
                  .map((n) => ({ label: n.name, value: n.dev.commitsChangePct }))}
              />
            </Chart>
          </div>
        )}
        {missingReasons.size > 0 && (
          <div className="bf-rp-note bf-rp-note--warn">
            <h4>
              {withCommits.length === 0 ? "Actividad de desarrollo no disponible en este corte" : "Sin conteo de commits en este corte"}
            </h4>
            {[...missingReasons].map(([reason, names]) => (
              <p key={reason}>
                <strong>{names.length === networks.length ? "Todas las redes" : names.join(", ")}:</strong> {reason}
              </p>
            ))}
          </div>
        )}

        <div className="bf-rp-duo">
          <Chart
            title="Stack para construir"
            note="0-10 sobre el registro: frameworks, faucet, grants, abstracción de cuentas, oráculos, indexadores y SDK."
          >
            <BarRows
              width={W_HALF}
              gutter={86}
              valueWidth={36}
              subWidth={60}
              rowH={20}
              color={CATEGORICAL[2]}
              format={(v) => v.toFixed(1)}
              items={byTooling.map((n) => ({ label: n.name, value: toolingScore(n), sub: n.vm }))}
            />
          </Chart>
          <Chart
            title="Seguridad"
            note="0-10. En L2, stage y riesgos de L2BEAT; en L1, nota editorial del BBI. Son dos bases distintas."
          >
            <BarRows
              width={W_HALF}
              gutter={86}
              valueWidth={36}
              subWidth={60}
              rowH={20}
              color={CATEGORICAL[4]}
              format={(v) => v.toFixed(1)}
              items={bySecurity.map((n) => ({
                label: n.name,
                value: n.arch.securityScore!,
                sub: n.layer === "L2" ? "L2BEAT" : "BBI",
              }))}
            />
          </Chart>
        </div>

        <h3>Fichas técnicas</h3>
        <p className="bf-rp-muted">
          Registro curado revisado el {data.registry.techReviewedAt}. Solo se imprimen los parámetros que cada red
          documenta.
        </p>
        <div className="bf-rp-netcards">
          {ranked.map((n) => (
            <NetCard key={n.id} network={n} />
          ))}
        </div>
      </ReportSection>

      {/* ── 09 Casos de uso ─────────────────────────────────────── */}
      <ReportSection
        code="09"
        layer={LAYER}
        title="Builder Radar: qué red para qué proyecto"
        lead="El mismo índice con los pesos de cada caso de uso: no existe una red mejor, existe la mejor para lo que se va a construir."
        pageBreak
      >
        <div className="bf-rp-trio">
          {PROFILES.map((profile) => {
            const results = scoreUniverse(networks, profile.id);
            const top = [...networks]
              .filter((n) => results.get(n.id)?.score != null)
              .sort((a, b) => results.get(b.id)!.score! - results.get(a.id)!.score!)
              .slice(0, 3);
            return (
              <Chart key={profile.id} title={profile.label} note={profile.question}>
                <BarRows
                  width={W_THIRD}
                  gutter={78}
                  valueWidth={28}
                  rowH={20}
                  color={GOLD}
                  format={(v) => v.toFixed(0)}
                  items={top.map((n) => ({ label: n.name, value: results.get(n.id)!.score! }))}
                />
              </Chart>
            );
          })}
        </div>

        <Chart
          wide
          title="Cómo pesa cada caso de uso"
          note="Reparto de los 100 puntos entre los cinco pilares. Algunos perfiles además refuerzan componentes dentro de un pilar."
          legend={<Legend items={PILLARS.map((p, i) => ({ label: p.label, color: CATEGORICAL[i] }))} />}
        >
          <div className="bf-rp-weights">
            {PROFILES.map((profile) => (
              <div key={profile.id} className="bf-rp-weights-row">
                <span>{profile.label}</span>
                <StackedShare
                  width={W_FULL - 140}
                  height={20}
                  items={PILLARS.map((p, i) => ({
                    label: p.label,
                    value: profile.pillars[p.id],
                    color: CATEGORICAL[i],
                  }))}
                />
              </div>
            ))}
          </div>
        </Chart>

        {signals.length > 0 && (
          <>
            <h3>Señales de tendencia · 30 días</h3>
            <div className="bf-rp-duo">
              {signals.map((signal) => (
                <div key={signal.id} className="bf-rp-note">
                  <h4>
                    {signal.network} · {signal.signal}
                  </h4>
                  <p>{signal.data.map((d) => `${d.label}: ${d.value}`).join(" · ")}</p>
                  <p>{signal.interpretation}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="bf-rp-note bf-rp-note--gold">
          <h4>Cómo se calcula el {INDEX_NAME}</h4>
          <p>
            Solo entran a la nota datos que existen para las {data.universe} redes: comisiones y usuarios, TVL y
            stablecoins, volumen DEX, protocolos, commits, stack registrado y seguridad. Cada componente se recorta a
            los percentiles 5 y 95, se escala de 0 a 100 —en logaritmo donde la magnitud es multiplicativa— y se
            invierte donde lo bajo es mejor. Un dato ausente no puntúa cero: se renormalizan los pesos disponibles. La
            tendencia combina la variación del TVL (85%) con la de commits (15%), ajustada por tamaño. El costo por
            transacción, que solo publican Ethereum y sus L2, queda como detalle. El stage de L2BEAT convertido a
            puntos es un criterio editorial de Blockfinity, no una calificación de L2BEAT. Las fuentes y su hora de
            consulta están en el capítulo 11.
          </p>
        </div>
      </ReportSection>
    </>
  );
}
