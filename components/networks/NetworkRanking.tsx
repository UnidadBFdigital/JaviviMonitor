"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { INDEX_NAME, type ProfileId } from "@/lib/networks/score";
import { Delta, Info, LayerChip, Na, ScoreBar, TrendChip, formatCost, formatCount, formatUsd, formatPctValue } from "./atoms";
import { activeAddresses, feesPerActiveUser } from "@/lib/networks/series";
import { useIntel, type Row } from "./useNetworkIntel";

// Ranking maestro. Cada columna existe para las quince redes: la tabla compara
// con la misma vara. Los atajos reordenan; los marcados con ◆ cambian además
// el perfil de pesos, que es lo que de verdad cambia la respuesta a "cuál me
// conviene".

type Shortcut = {
  label: string;
  sort: { key: string; dir: "asc" | "desc" };
  profile?: ProfileId;
  hint: string;
};

const SHORTCUTS: Shortcut[] = [
  { label: "Mejor puntaje", sort: { key: "score", dir: "desc" }, profile: "general", hint: "Perfil general del índice." },
  { label: "Más usuarios", sort: { key: "users", dir: "desc" }, hint: "Direcciones activas en 24h." },
  { label: "Comisiones más bajas", sort: { key: "fees", dir: "asc" }, hint: "Comisiones de red por usuario activo." },
  { label: "Más capital", sort: { key: "tvl", dir: "desc" }, hint: "TVL de la red." },
  { label: "Crecen más", sort: { key: "momentum", dir: "desc" }, hint: "Tendencia del TVL ajustada por tamaño." },
  { label: "Más desarrollo", sort: { key: "commits", dir: "desc" }, hint: "Commits del repositorio núcleo en 12 semanas." },
  { label: "Para pagos", sort: { key: "score", dir: "desc" }, profile: "payments", hint: "Pesa comisiones, stablecoins y usuarios." },
  { label: "Para DeFi", sort: { key: "score", dir: "desc" }, profile: "defi", hint: "Pesa TVL, volumen DEX y protocolos." },
  { label: "Para RWA", sort: { key: "score", dir: "desc" }, profile: "rwa", hint: "Pesa capital en dólares y seguridad." },
];

export function NetworkRanking({ onOpen }: { onOpen: (id: string) => void }) {
  const { rows, profile, setProfile } = useIntel();
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "score", dir: "desc" });
  const [active, setActive] = useState<string>("Mejor puntaje");

  const columns: Column<Row>[] = [
    {
      key: "network",
      header: "Red",
      required: true,
      value: (r) => r.network.name,
      render: (r) => (
        <button
          type="button"
          onClick={() => onOpen(r.network.id)}
          className="flex items-center gap-1.5 text-left transition-colors hover:text-electric"
        >
          <span className="font-medium">{r.network.name}</span>
          <LayerChip network={r.network} />
        </button>
      ),
    },
    {
      key: "score",
      header: INDEX_NAME,
      numeric: true,
      value: (r) => r.score.score,
      render: (r) => (
        <span className="flex justify-end">
          <ScoreBar value={r.score.score} gold reason="Faltan datos en dos o más pilares para esta red." />
        </span>
      ),
    },
    {
      key: "users",
      header: "Usuarios 24h",
      numeric: true,
      value: (r) => activeAddresses(r.network).value,
      render: (r) => {
        const { value, source } = activeAddresses(r.network);
        return value === null ? <Na reason={source} /> : <span className="tabular-nums" title={source}>{formatCount(value)}</span>;
      },
    },
    {
      key: "fees",
      header: "Comisión por usuario",
      numeric: true,
      value: (r) => feesPerActiveUser(r.network).value,
      render: (r) => {
        const { value, source } = feesPerActiveUser(r.network);
        return value === null ? <Na reason={source} /> : <span className="tabular-nums" title={source}>{formatCost(value)}</span>;
      },
    },
    {
      key: "tvl",
      header: "TVL",
      numeric: true,
      value: (r) => r.network.liquidity.tvlUsd,
      render: (r) => (
        <span className="tabular-nums">
          {formatUsd(r.network.liquidity.tvlUsd)}
          {r.network.liquidity.tvlChange30dPct !== null && (
            <span className="block text-[10px]">
              <Delta value={r.network.liquidity.tvlChange30dPct} />
            </span>
          )}
        </span>
      ),
    },
    {
      key: "stables",
      header: "Stablecoins",
      numeric: true,
      value: (r) => r.network.liquidity.stablecoinUsd,
      render: (r) => <span className="tabular-nums">{formatUsd(r.network.liquidity.stablecoinUsd)}</span>,
    },
    {
      key: "dex",
      header: "DEX 24h",
      numeric: true,
      value: (r) => r.network.liquidity.dexVolume24hUsd,
      render: (r) => <span className="tabular-nums">{formatUsd(r.network.liquidity.dexVolume24hUsd)}</span>,
    },
    {
      key: "commits",
      header: "Commits 12s",
      numeric: true,
      value: (r) => r.network.dev.commits12w,
      render: (r) =>
        r.network.dev.commits12w === null ? (
          <Na reason={r.network.dev.unavailable ?? undefined} />
        ) : (
          <span className="tabular-nums" title={r.network.dev.repo}>
            {formatCount(r.network.dev.commits12w)}
            {r.network.dev.commitsChangePct !== null && (
              <span className="block text-[10px]">
                <Delta value={r.network.dev.commitsChangePct} />
              </span>
            )}
          </span>
        ),
    },
    {
      key: "momentum",
      header: "Tendencia",
      numeric: true,
      value: (r) => r.momentum.score,
      render: (r) => (
        <span className="flex items-center justify-end gap-1.5">
          <span className="tabular-nums">{formatPctValue(r.momentum.rawGrowthPct)}</span>
          <TrendChip signal={r.momentum.signal} />
        </span>
      ),
    },
  ];

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="bf-slash" aria-hidden />
          Ranking de redes
          <Info text={`El ${INDEX_NAME} se normaliza sobre las 15 redes del registro: los filtros cambian qué se ve, no las notas.`} />
        </h3>
        <p className="text-[11px] text-ink-secondary">Tocá una red para abrir su ficha · {rows.length} redes</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {SHORTCUTS.map((shortcut) => {
          const on = active === shortcut.label;
          return (
            <button
              key={shortcut.label}
              type="button"
              title={shortcut.hint}
              aria-pressed={on}
              onClick={() => {
                setSort(shortcut.sort);
                setActive(shortcut.label);
                if (shortcut.profile) setProfile(shortcut.profile);
              }}
              className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                on
                  ? "border-electric bg-electric/10 text-ink"
                  : "border-line text-ink-secondary hover:border-electric/60 hover:text-ink"
              }`}
            >
              {shortcut.label}
              {shortcut.profile && shortcut.profile !== "general" && <span className="ml-1 text-gold">◆</span>}
            </button>
          );
        })}
      </div>

      <DataTable
        key={`${sort.key}-${sort.dir}-${profile}`}
        rows={rows}
        columns={columns}
        exportName="blockfinity-builder-radar"
        initialSort={sort}
        maxHeight="max-h-[34rem]"
      />

      <p className="mt-2 text-[11px] text-ink-muted">
        ◆ cambia el perfil de pesos del índice, no solo el orden. Comisión por usuario = comisiones de red
        de 24h ÷ direcciones activas: no es el costo de una transacción.
      </p>
    </section>
  );
}
