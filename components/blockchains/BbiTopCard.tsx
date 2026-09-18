"use client";

import Link from "next/link";
import { formatUsdCompact } from "@/lib/format";
import { useBlockchains, GroupChip } from "./useBlockchains";

// Podio del BBI para la portada, con las seis barras de categoría de la red
// líder. Muestra el índice y de qué está hecho, no solo el número.
const CATS: { key: keyof BbiScores; label: string }[] = [
  { key: "seguridad", label: "Seg" },
  { key: "adopcion", label: "Adop" },
  { key: "escalabilidad", label: "Escal" },
  { key: "ecosistema", label: "Ecos" },
  { key: "institucional", label: "Inst" },
  { key: "compliance", label: "Comp" },
];

type BbiScores = {
  seguridad: number;
  adopcion: number;
  escalabilidad: number;
  ecosistema: number;
  institucional: number;
  compliance: number;
};

function tone(v: number): string {
  if (v >= 8.5) return "text-up";
  if (v >= 6.5) return "text-ink";
  if (v >= 4.5) return "text-warn";
  return "text-down";
}

export function BbiTopCard({ limit = 6 }: { limit?: number }) {
  const { data, error } = useBlockchains();

  if (error)
    return (
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Blockfinity Blockchain Index</h3>
        <p className="py-6 text-sm text-ink-muted">No disponible.</p>
      </section>
    );

  if (!data)
    return (
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-sm font-semibold">Blockfinity Blockchain Index</h3>
        <div className="mt-3 h-72 animate-pulse rounded bg-ice/50" />
      </section>
    );

  const top = data.networks.filter(n => n.comparable).slice(0, limit);
  const lider = top[0];

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Blockfinity Blockchain Index</h3>
        <Link
          href="/blockchains/scorecard"
          className="text-[11px] text-core underline hover:text-electric"
        >
          Scorecard completo →
        </Link>
      </div>
      <p className="mb-3 text-xs text-ink-secondary">
        BBI v2: 40% actividad observable y 60% evaluación editorial. Podio de redes con cobertura completa.
      </p>

      <ol className="space-y-1.5">
        {top.map((n, i) => (
          <li
            key={n.name}
            className="flex items-center gap-3 border-b border-line/50 pb-1.5 last:border-0"
          >
            <span className="w-4 shrink-0 text-right text-[12px] font-bold tabular-nums text-ink-muted">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px]">{n.name}</span>
            <GroupChip group={n.group} />
            <span className="shrink-0 text-[11px] tabular-nums text-ink-secondary">
              {n.tvlUsd !== null ? formatUsdCompact(n.tvlUsd) : "n/a"}
            </span>
            <span className={`w-10 shrink-0 text-right text-sm font-bold tabular-nums ${tone(n.bbi)}`}>
              {n.bbi.toFixed(1)}
              {n.bbiPartial && <span className="text-[9px] text-ink-muted">*</span>}
            </span>
          </li>
        ))}
      </ol>
      {top.length === 0 && <p className="py-4 text-xs text-ink-muted">Cobertura insuficiente para publicar el podio. Las fichas parciales están en el scorecard.</p>}

      {lider && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Perfil del líder · {lider.name}
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {CATS.map((c) => {
              const v = lider.scores[c.key];
              return (
                <div key={c.key}>
                  <div className="flex h-16 items-end justify-center rounded bg-ice/60">
                    <div
                      className="w-full rounded-b bg-electric/70"
                      style={{ height: `${v * 10}%` }}
                    />
                  </div>
                  <p className="mt-1 text-center text-[9px] text-ink-muted">{c.label}</p>
                  <p className="text-center text-[10px] font-semibold tabular-nums">{v}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
