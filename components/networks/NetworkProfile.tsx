"use client";

import { useEffect } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { INDEX_NAME, toolingScore } from "@/lib/networks/score";
import { activeAddresses, feesPerActiveUser } from "@/lib/networks/series";
import { Delta, FreshnessTag, Info, ScoreBar, TrendChip, formatCost, formatCount, formatPctValue, formatUsd } from "./atoms";
import { useIntel, type Row as IntelRow } from "./useNetworkIntel";

// Ficha de red. Se abre desde cualquier tabla y responde la pregunta que
// sigue a "esta red lidera": por qué y con qué datos. Una fila sin dato no se
// dibuja; el detalle que solo existe para Ethereum y sus L2 aparece rotulado
// cuando la red lo tiene.

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/50 py-1 last:border-0">
      <span className="text-[11px] text-ink-secondary">
        {label}
        {hint && <Info text={hint} />}
      </span>
      <span className="shrink-0 text-right text-[11px] tabular-nums">{value}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-electric">{title}</p>
      {children}
    </div>
  );
}

const list = (items: string[]) => (items.length > 0 ? items.join(", ") : "Sin registro");

export function NetworkProfile({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { rows, payload } = useIntel();

  useEffect(() => {
    if (!id) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, onClose]);

  if (!id) return null;
  const row = rows.find((r) => r.network.id === id);
  if (!row) return null;

  const { network, score, momentum } = row;
  const fees = feesPerActiveUser(network);
  const users = activeAddresses(network);
  const hasEvmCost = network.cost.medianUsd !== null;
  const hasEvmActivity = network.activity.txCount24h !== null;

  const rankOf = (value: (r: IntelRow) => number | null, highest = true) => {
    const ordered = rows
      .filter((r) => value(r) !== null)
      .sort((a, b) => (highest ? value(b)! - value(a)! : value(a)! - value(b)!));
    const position = ordered.findIndex((r) => r.network.id === id);
    return position < 0 ? null : `${position + 1}/${ordered.length}`;
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-surface/70" onClick={onClose} role="presentation">
      <aside
        className="bf-reveal h-full w-full max-w-xl overflow-y-auto border-l border-line bg-card p-4"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`Ficha de ${network.name}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-line pb-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-electric">
              {network.layer} · {network.arch.category ?? network.kind}
            </p>
            <h3 className="text-lg font-semibold tracking-tight">{network.name}</h3>
            <p className="mt-0.5 text-[11px] text-ink-secondary">
              {network.language} · {network.vm} · token {network.gasToken} · desde {network.launched}
              {network.settlesOn && ` · liquida en ${network.settlesOn}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-line px-2 py-1 text-[11px] text-ink-secondary hover:bg-ice/50 hover:text-ink"
          >
            Cerrar ✕
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="bf-premium border border-charcoal-line p-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">{INDEX_NAME}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gold-bright">
              {score.score === null ? "—" : score.score.toFixed(0)}
              <span className="text-xs font-normal text-ink-muted">/100</span>
            </p>
            <p className="text-[10px] text-ink-muted">puesto {rankOf((r) => r.score.score) ?? "—"} en el perfil elegido</p>
          </div>
          <div className="border border-line bg-card-raised p-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">Tendencia 30d</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{formatPctValue(momentum.rawGrowthPct)}</span>
              <TrendChip signal={momentum.signal} />
            </p>
            <p className="text-[10px] text-ink-muted">TVL con 15% de commits · puesto {rankOf((r) => r.momentum.score) ?? "—"}</p>
          </div>
        </div>

        <div className="mb-4 space-y-1">
          {score.pillars.map((pillar) => (
            <div key={pillar.id} className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-ink-secondary">{pillar.label}</span>
              <ScoreBar value={pillar.score} reason="Sin datos suficientes para este pilar." />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Block title="Costo de uso">
            {fees.value !== null && (
              <Row label="Comisión por usuario activo" value={formatCost(fees.value)} hint={`Comisiones de 24h ÷ direcciones activas (${fees.source}).`} />
            )}
            {network.liquidity.chainFees24hUsd !== null && (
              <Row label="Comisiones de red 24h" value={formatUsd(network.liquidity.chainFees24hUsd)} />
            )}
            {fees.value !== null && <Row label="Puesto por comisión" value={rankOf((r) => feesPerActiveUser(r.network).value, false) ?? "—"} />}
            {hasEvmCost && (
              <>
                <p className="mt-2 text-[9px] uppercase tracking-[0.1em] text-ink-muted">Detalle EVM · growthepie</p>
                <Row label="Costo mediano por transacción" value={formatCost(network.cost.medianUsd)} />
                {network.cost.min30dUsd !== null && (
                  <Row label="Rango 30d" value={`${formatCost(network.cost.min30dUsd)} – ${formatCost(network.cost.max30dUsd)}`} />
                )}
                {network.cost.change30dPct !== null && <Row label="Variación 30d" value={<Delta value={network.cost.change30dPct} invert />} />}
                {network.history.cost.length > 2 && (
                  <div className="mt-1.5">
                    <Sparkline values={network.history.cost.map((p) => p.value)} width={200} height={30} positive={false} />
                  </div>
                )}
              </>
            )}
            <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">{network.feeModel}</p>
          </Block>

          <Block title="Uso y capital">
            {users.value !== null && <Row label="Usuarios activos 24h" value={formatCount(users.value)} hint={`No equivale a personas únicas · ${users.source}.`} />}
            <Row
              label="TVL"
              value={
                <>
                  {formatUsd(network.liquidity.tvlUsd)}
                  {network.liquidity.tvlChange30dPct !== null && (
                    <span className="ml-1.5 text-[10px]">
                      <Delta value={network.liquidity.tvlChange30dPct} />
                    </span>
                  )}
                </>
              }
            />
            <Row label="Stablecoins" value={formatUsd(network.liquidity.stablecoinUsd)} />
            <Row label="Volumen DEX 24h" value={formatUsd(network.liquidity.dexVolume24hUsd)} />
            <Row label="Protocolos" value={formatCount(network.liquidity.protocols)} />
            <Row label="TVL de RWA" value={formatUsd(network.rwa.tvlUsd)} hint={network.rwa.note} />
            {hasEvmActivity && (
              <>
                <p className="mt-2 text-[9px] uppercase tracking-[0.1em] text-ink-muted">Detalle EVM · growthepie</p>
                <Row label="Transacciones diarias" value={formatCount(network.activity.txCount24h)} />
                {network.activity.observedTps !== null && (
                  <Row label="Transacciones por segundo" value={network.activity.observedTps.toFixed(1)} hint="Observado, no capacidad teórica." />
                )}
              </>
            )}
            {network.history.tvl.length > 2 && (
              <div className="mt-1.5">
                <Sparkline values={network.history.tvl.map((p) => p.value)} width={200} height={30} />
              </div>
            )}
          </Block>

          <Block title="Desarrollo">
            <Row label="Repositorio núcleo" value={<span className="font-mono text-[10px]">{network.dev.repo}</span>} hint={network.dev.repoNote ?? undefined} />
            {network.dev.commits12w !== null ? (
              <>
                <Row label="Commits 4 semanas" value={formatCount(network.dev.commits4w)} />
                <Row label="Commits 12 semanas" value={formatCount(network.dev.commits12w)} />
                {network.dev.commitsChangePct !== null && <Row label="Variación" value={<Delta value={network.dev.commitsChangePct} />} />}
              </>
            ) : (
              <p className="py-1 text-[10px] text-ink-muted">{network.dev.unavailable ?? "GitHub no respondió en esta consulta."}</p>
            )}
            <Row label="Stack registrado" value={`${toolingScore(network).toFixed(1)}/10`} />
            <Row label="SDK" value={list(network.tooling.sdks)} />
            <Row label="Abstracción de cuentas" value={network.tooling.accountAbstraction} />
            <Row label="Oráculos" value={list(network.tooling.oracles)} />
            <Row label="Indexadores" value={list(network.tooling.indexers)} />
          </Block>

          <Block title="Arquitectura y riesgo">
            <Row label="Categoría" value={network.arch.category ?? network.kind} />
            {network.arch.stage && <Row label="Stage L2BEAT" value={network.arch.stage} />}
            {network.arch.dataAvailability && <Row label="Disponibilidad de datos" value={network.arch.dataAvailability} />}
            {network.arch.blockTimeSec !== null && <Row label="Tiempo de bloque" value={`${network.arch.blockTimeSec}s`} />}
            {network.arch.finalitySec !== null ? (
              <Row label="Finalidad" value={`${network.arch.finalitySec}s`} hint={network.finalityNote} />
            ) : (
              network.finalityNote && <Row label="Finalidad" value={<span className="text-ink-muted">ver nota</span>} hint={network.finalityNote} />
            )}
            {network.arch.securityScore !== null && (
              <Row label="Seguridad" value={`${network.arch.securityScore.toFixed(1)}/10`} hint={network.arch.securityBasis ?? undefined} />
            )}
            {network.arch.risks.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {network.arch.risks.map((risk) => (
                  <li key={risk.name} className="text-[10px] leading-relaxed">
                    <span className={risk.sentiment === "bad" ? "text-down" : risk.sentiment === "warning" ? "text-warn" : "text-up"}>●</span>{" "}
                    <span className="text-ink-secondary">
                      {risk.name}: {risk.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Para empezar a construir</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <a href={network.docs} target="_blank" rel="noreferrer" className="text-core hover:text-electric">
              Documentación ↗
            </a>
            <a href={`https://github.com/${network.repo}`} target="_blank" rel="noreferrer" className="text-core hover:text-electric">
              Repositorio ↗
            </a>
            {network.faucet && (
              <a href={network.faucet} target="_blank" rel="noreferrer" className="text-core hover:text-electric">
                Faucet ↗
              </a>
            )}
            {network.grants && (
              <a href={network.grants} target="_blank" rel="noreferrer" className="text-core hover:text-electric">
                Grants ↗
              </a>
            )}
            {network.explorers.slice(0, 2).map((explorer) => (
              <a key={explorer.url} href={explorer.url} target="_blank" rel="noreferrer" className="text-core hover:text-electric">
                {explorer.label} ↗
              </a>
            ))}
            {network.rpcs.slice(0, 1).map((rpc) => (
              <span key={rpc.url} className="text-ink-muted">
                RPC: {rpc.label}
              </span>
            ))}
          </div>

          {payload && (
            <div className="mt-2 space-y-0.5">
              {network.sources.map((source) => (
                <p key={source.block} className="flex items-center justify-between gap-2 text-[10px] text-ink-muted">
                  <span className="truncate">
                    {source.block} · {source.source}
                  </span>
                  <FreshnessTag freshness={source.freshness} fetchedAt={source.fetchedAt} />
                </p>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
