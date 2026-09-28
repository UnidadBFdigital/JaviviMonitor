"use client";

import type { Freshness, NetworkMetrics } from "@/lib/networks/types";
import { INDEX_NAME, type Momentum, type ScoredNetworkResult } from "@/lib/networks/score";
import { Delta, FreshnessTag, Info, MiniSpark, formatCost, formatCount, formatUsd, formatPctValue } from "./atoms";
import { activeAddresses, feesPerActiveUser } from "@/lib/networks/series";
import { useIntel, type Row } from "./useNetworkIntel";

// Lectura de siete segundos: quién lidera cada pregunta, con la cifra, su
// variación cuando existe y la cadencia real de la fuente. Todas las fichas
// usan datos que existen para las quince redes: ninguna queda vacía por un
// problema de cobertura.

type Leader = {
  key: string;
  question: string;
  definition: string;
  row: Row | null;
  value: string;
  delta: number | null;
  invertDelta?: boolean;
  period: string;
  spark: number[];
  sparkPositive: boolean;
  source: string;
  freshness: Freshness;
  fetchedAt: string | null;
  gold?: boolean;
};

function best(rows: Row[], value: (r: Row) => number | null, highest = true): Row | null {
  const withValue = rows.filter((r) => value(r) !== null);
  if (withValue.length === 0) return null;
  return withValue.reduce((leader, row) =>
    (highest ? value(row)! > value(leader)! : value(row)! < value(leader)!) ? row : leader
  );
}

function Tile({ leader }: { leader: Leader }) {
  return (
    <article
      className={`bf-reveal flex flex-col justify-between border p-2.5 ${
        leader.gold ? "bf-premium border-charcoal-line" : "border-line bg-card"
      }`}
    >
      <p className="flex items-start text-[10px] uppercase tracking-[0.08em] text-ink-muted">
        <span className="min-w-0">{leader.question}</span>
        <Info text={leader.definition} />
      </p>

      {leader.row === null ? (
        <p className="mt-2 text-[11px] text-ink-muted">Ninguna red del filtro actual publica este dato.</p>
      ) : (
        <>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <p className={`truncate text-[13px] font-semibold ${leader.gold ? "text-gold-bright" : "text-ink"}`}>
              {leader.row.network.name}
            </p>
            <p className="shrink-0 text-sm font-semibold tabular-nums">{leader.value}</p>
          </div>
          <div className="mt-1 flex min-h-5 items-end justify-between gap-2">
            <span className="text-[10px]">
              {leader.delta !== null && <Delta value={leader.delta} invert={leader.invertDelta} />}
              <span className="ml-1 text-ink-muted">{leader.period}</span>
            </span>
            <MiniSpark values={leader.spark} positive={leader.sparkPositive} />
          </div>
        </>
      )}

      <p className="mt-1.5 flex items-center justify-between gap-2 border-t border-line/70 pt-1 text-[10px] text-ink-muted">
        <span className="truncate">{leader.source}</span>
        <FreshnessTag freshness={leader.freshness} fetchedAt={leader.fetchedAt} compact />
      </p>
    </article>
  );
}

export function OverviewStrip() {
  const { rows, payload } = useIntel();
  if (!payload) return null;

  const at = (block: string) => payload.sources.find((s) => s.block.startsWith(block)) ?? null;
  const llama = at("Panel de actividad");
  const tvlSpark = (network: NetworkMetrics) => network.history.tvl.slice(-30).map((p) => p.value);

  const mostUsers = best(rows, (r) => activeAddresses(r.network).value);
  const cheapest = best(rows, (r) => feesPerActiveUser(r.network).value, false);
  const mostTvl = best(rows, (r) => r.network.liquidity.tvlUsd);
  const mostStables = best(rows, (r) => r.network.liquidity.stablecoinUsd);
  const momentumLeader = best(rows, (r) => r.momentum.score);
  const indexLeader = best(rows, (r) => r.score.score);

  const leaders: Leader[] = [
    {
      key: "users",
      question: "Más usuarios",
      definition: "Direcciones activas en 24h. Incluye automatización y no equivale a personas únicas.",
      row: mostUsers,
      value: formatCount(mostUsers ? activeAddresses(mostUsers.network).value : null),
      delta: null,
      period: "últimas 24h",
      spark: [],
      sparkPositive: true,
      source: mostUsers ? activeAddresses(mostUsers.network).source : "DeFiLlama",
      freshness: "HOURLY",
      fetchedAt: llama?.fetchedAt ?? null,
    },
    {
      key: "cheapest",
      question: "Menor comisión por usuario",
      definition:
        "Comisiones de red de 24h divididas por las direcciones activas del día: cuánto gasta en comisiones un usuario activo. No es el costo de una transacción.",
      row: cheapest,
      value: formatCost(cheapest ? feesPerActiveUser(cheapest.network).value : null),
      delta: null,
      period: "por usuario · 24h",
      spark: [],
      sparkPositive: true,
      source: "DeFiLlama",
      freshness: "HOURLY",
      fetchedAt: llama?.fetchedAt ?? null,
    },
    {
      key: "tvl",
      question: "Más capital en DeFi",
      definition: "TVL: capital depositado en los protocolos de la red.",
      row: mostTvl,
      value: formatUsd(mostTvl?.network.liquidity.tvlUsd ?? null),
      delta: mostTvl?.network.liquidity.tvlChange30dPct ?? null,
      period: "30d",
      spark: mostTvl ? tvlSpark(mostTvl.network) : [],
      sparkPositive: (mostTvl?.network.liquidity.tvlChange30dPct ?? 0) >= 0,
      source: "DeFiLlama",
      freshness: "HOURLY",
      fetchedAt: llama?.fetchedAt ?? null,
    },
    {
      key: "stables",
      question: "Más dólares digitales",
      definition: "Oferta de stablecoins en circulación en la red: el dinero disponible para pagar y liquidar.",
      row: mostStables,
      value: formatUsd(mostStables?.network.liquidity.stablecoinUsd ?? null),
      delta: null,
      period: "en circulación",
      spark: [],
      sparkPositive: true,
      source: "DeFiLlama",
      freshness: "HOURLY",
      fetchedAt: llama?.fetchedAt ?? null,
    },
    {
      key: "momentum",
      question: "Crece más rápido",
      definition:
        "Tendencia del TVL a 30 días con un 15% de commits, ajustada por tamaño para que una base chica no lidere sola.",
      row: momentumLeader,
      value: formatPctValue(momentumLeader?.momentum.rawGrowthPct ?? null),
      delta: null,
      period: "30d · ajustado por tamaño",
      spark: momentumLeader ? tvlSpark(momentumLeader.network) : [],
      sparkPositive: (momentumLeader?.momentum.rawGrowthPct ?? 0) >= 0,
      source: "DeFiLlama · GitHub",
      freshness: "DAILY",
      fetchedAt: llama?.fetchedAt ?? null,
    },
    {
      key: "index",
      question: `Mejor ${INDEX_NAME}`,
      definition: `${INDEX_NAME} de Blockfinity: costo de uso, facilidad para desarrollar, uso real, capital y seguridad, normalizados sobre las ${payload.universe} redes.`,
      row: indexLeader,
      value: indexLeader?.score.score != null ? `${indexLeader.score.score.toFixed(0)}/100` : "—",
      delta: null,
      period: "perfil general",
      spark: [],
      sparkPositive: true,
      source: "Blockfinity BBIM",
      freshness: "DAILY",
      fetchedAt: payload.generatedAt,
      gold: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {leaders.map((leader) => (
        <Tile key={leader.key} leader={leader} />
      ))}
    </div>
  );
}

/** Ayuda a otros paneles a resaltar al líder de una métrica sin repetir lógica. */
export function leaderOf(rows: Row[], value: (r: Row) => number | null, highest = true): string | null {
  return best(rows, value, highest)?.network.id ?? null;
}

export type { ScoredNetworkResult, Momentum };
